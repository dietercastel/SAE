//Requires
var crypto = require('crypto');
var fs = require('fs');
var csp = require('content-security-policy');
var jf = require('jsonfile');
var util = require('util');
var path = require('path');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');
var er = require('./lib/excluderegex');
var clientSession = require('client-session');

//SETTINGS AND OPTIONS RELATED
var requiredOptions = ["projectPath","keyPath","failedAuthFunction"];
function getDefaults(){
	return { 
		//REQUIRED!!
		projectPath: undefined,
		keyPath: undefined,
		failedAuthFunction: undefined,
		//OPTIONAL
		//Which route to use for (various e.g. csp) reports.
		//Report route will be excluded from auth by default.
		reportRoute : '/reporting',
		//CSP options:
		cspReportOnly : false,
		//Prefix to pass through proxy, important for reporting URL.
		proxyPrefix : '', 
		//Csp file to use. Can be generated with grunt-csp-express.
		cspFile: '/csp.json',
		//File to store csp reports in.
		cspReports : '/cspReports.log',
		//Use the JSON escaping countermeasure described in angular docs.
		useJSONPCM: true,
		//Exclude the '/' route from authentication.
		excludeAuthRoot: true,
		//List of Routes to exclude from authentication.
		excludedAuthRoutes : [],
		//Session (and anti-XSRF token) lifetime.
		sessionLifeTime : 3600,
		//Serve cookies only over https TODO?
		//How does this interact with proxy/other settings?
		//Rename??
		httpsOnlyCookie : false 
	};
}

//  Overrides the default options with the user supplied options.
//  Throws an error if not all required options are provided.
function overrideDefaults(defaults, options){
	var resultObject = defaults; 
	var stillRequired = requiredOptions;
	var reqIdx;	
	Object.keys(options).forEach(function(name){
		resultObject[name] = options[name];
		reqIdx = stillRequired.indexOf(name);
		if(reqIdx >= 0){
			stillRequired.splice(reqIdx,1);
		}
	});
	if(stillRequired.length !== 0 ){
		throw new Error("The following options are required: "+stillRequired);
	}
	return resultObject;
}

//CSP RELATED FUNCTIONS
//Custom :cspreport logging token with morgan
morgan.token('cspreport', function(req, res){ 
	return '\n'+util.inspect(req.body["csp-report"]).toString(); 
});

//Use the content-security-policy middleware
function useCSP(cspopt,opt){
	//TODO: see if this is necessary
	//Probably needed with all srcs
	// cspopt["default-src"] = csp.SRC_NONE; 
	cspopt["connect-src"] = csp.SRC_SELF; 
	cspopt["report-uri"] = opt["proxyPrefix"] + opt["reportRoute"];
	cspopt["report-only"] = opt["cspReportOnly"];
	console.log("CSP: using following configuration:");
	console.log(util.inspect(cspopt));
	if(opt["cspReportOnly"]){
		console.log("CSP: Report only mode on. This is NOT recommended.");
	}
	return csp.getCSP(cspopt);
}

//Configure CSP policy with the given options.
function configureCsp(app, bodyParser, opt){
	var cspLogPath = path.join(opt["projectPath"],opt["cspReports"]);
	var cspLogStream = fs.createWriteStream(cspLogPath, {flags: 'a'});
	var cspReportParser = bodyParser.json({type: 'application/csp-report'});
	//Set routes FIRST before doing sync file read.
	app.post(opt["reportRoute"], cspReportParser, morgan(':date[clf]] :cspreport', {stream : cspLogStream}));
	var cspFileName = path.join(opt["projectPath"],opt["cspFile"]);
	var cspopt;
	try{ 
		//Blocking file read needed.
		cspopt = jf.readFileSync(cspFileName);
	} catch (err) {
		//on any error use starter options and report
		console.log("CSP: no proper path provided, using starter options.");
		cspopt = csp.STARTER_OPTIONS;
	}
	app.use(useCSP(cspopt,opt));
}

// Implementation for anti XSRF/CSRF double submit cookie.
function setXSRFToken(res){
	// var randomtoken = "NOTARANDOMTOKEN";
	try{
		var buf = crypto.randomBytes(256);
		var randomtoken = buf.toString('base64');
		console.log("SETTING anti XSRF TOKEN");
		var headerValue = 'XSRF-TOKEN='+randomtoken+'; Path=/';
		if(res.sae.opt["httpsOnlyCookie"]){
			headerValue += "; Secure";
		}
		res.append('Set-Cookie', headerValue);
		res.append('X-Forwarded-Proto:', 'https');

	} catch(ex) { 
		console.log("Entropy sources drained.");
		throw ex;
	}
}

// Implementation for anti XSRF/CSRF double submit cookie.
function unsetXSRFToken(res){
	var headerValue = 'XSRF-TOKEN=; Path=/; Max-Age=1';
	if(res.sae.opt["httpsOnlyCookie"]){
		headerValue += "; Secure";
	}
	res.append('Set-Cookie', headerValue);
}

function sendNewSession(req, res, sessionData, sendData){
	console.log("newSession");
	//Initialise new session on req/res
	req.sae.cs.csget(req, res);
	//Set session data in REQ!!!
	req.csession = sessionData;	
	req.csession["authenticated"] = true;
	console.log("sending:\n" + util.inspect(req.csession));
	//Flush data to headers
	res.sae.cs.csset(req, res);
	//Set anti-XSRF token
	setXSRFToken(res);
	//and send the dataz.
	console.log("sendData:\n" + util.inspect(sendData));
	res.send(sendData);
}

function sendDestroySession(req, res, sendData){
	cs=req.sae.cs;
	cs.csget(req, res);
	//Probably not necessary to unset this.
	req.csession["authenticated"] = false;
	//Expire the cookie in 1 second.
	//NOTE: 0 would result in cookie deletion on closing the browser.
	cs.opt.maxAge = 1;
	cs.csset(req, res);
	unsetXSRFToken(res);
	res.send(sendData);
	//Reset maxAge since this is a global option.
	cs.opt.maxAge = req.sae.cs.sessionLifeTime;
}

/*
 * Adds SAE functionality and options to each request/response.
 */
function addSAE(opt, clientsession){ 
	return function (req, res, next){
		res.sae = {};
		req.sae = {};
		req.sae.cs = res.sae.cs = clientsession;
		req.sae.opt = res.sae.opt = opt;
		res.sae.sendNewSession = sendNewSession;
		res.sae.sendDestroySession = sendDestroySession;
		next();
	};
}

//MISC
/*
 * This function intercepts res.send()
 *	When a json body is about to be send
 *	The countermeasure string ")]}',\n" is added in front of it.
 *	The client-session is also flushed into the headers.
 *	An finally the normal send function is executed.
 *
 * After send is overwritten continue with next()
 */
function continueAuthedRoute(req, res, next){
	var sendRef = res.send;
	res.send = function(str){
		var newStr = str;
		if(res.sae.opt["useJSONPCM"]){
			//TODO:Evaulate if this is needed with anti-XSRF token?
			try {
				JSON.parse(str);
				// console.log("ADDING");
				newStr = ")]}',\n"+str;
			} catch (e) {
				//nop
			}
		}
		//Flush csession to headers.
		//TODO: is it needed if csession is empty???
		if(req.csession !== undefined &&
			Object.keys(req.csession) !==0){
			console.log("CSETTING!!!!");
			res.sae.cs.csset(req, res);
		}
		//Execute original send();
		sendRef.call(this,newStr);
	};
	next();
}

/*
 * If session + anti XSRF token is valid
 *	Executes next()
 * In any other case:
 *	Execute failedAuthFunction(req, res)
 */
function validateSession(req, res, next){
		console.log("#########This path is: " + req.path);
		//Check anti XSRF token
		var token = req.get('X-XSRF-TOKEN');
		var tokenCookie = req.cookies["XSRF-TOKEN"];
		console.log("Header token: "+token);
		console.log("Cookie token: "+tokenCookie);
//If the token was not found within the request or the value provided does not match the value within the session, then the request should be aborted, token should be reset and the event logged as a potential CSRF attack in progress. 
		if(token !== undefined && tokenCookie !==undefined && token === tokenCookie){
			console.log("Token OK");
			//XSRF token OK
			//Unwrap csession
			req.sae.cs.csget(req, res);
			console.log("csession:\n"+util.inspect(req.csession));
			if(req.csession["authenticated"]){
				console.log("TRUE");
				//Succesful auth let request go trough.
				continueAuthedRoute(req,res,next);
				return;
			}
		}
		//Handle bad request.
		//TODO:Logging?
		console.log("Auth Failed");
		req.sae.opt.failedAuthFunction(req, res);
		return;	
}


module.exports = function(myoptions) {
	var def= getDefaults();
	var opt= overrideDefaults(def, myoptions); 
	var csoptions = {
			path:'/',  
			maxAge: opt["sessionLifeTime"], 
			secure: opt["httpsOnlyCookie"],
			//TODO: currently NOT httpOnly!!!
			httpOnly: false 
	};
	var secretKeyFile = fs.readFileSync(opt["keyPath"], {encoding:'utf8'});
	var secretKey = secretKeyFile.toString().split("\n")[0];
	console.log(secretKey);
	var cs = clientSession(secretKey,csoptions);
	//Add reportRoute to exclusion of routes.
	opt["excludedAuthRoutes"].push(opt["reportRoute"]);
	var exclusionRegex = er.getExclusionRegex(opt["excludeAuthRoot"],opt["excludedAuthRoutes"]);
	return {
		configure: function(app,bodyParser){
			app.use(cookieParser());
			app.use(addSAE(opt,cs));
			console.log(exclusionRegex);
			app.use(exclusionRegex, validateSession);
			configureCsp(app,bodyParser,opt);
		},
		defaults: def,
		options: opt,
		authRoutes: exclusionRegex,
	};
};
