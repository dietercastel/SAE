//Requires
var crypto = require('crypto');
var fs = require('fs');
var csp = require('content-security-policy');
var jf = require('jsonfile');
var util = require('util');
var path = require('path');
var morgan = require('morgan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var er = require('./lib/excluderegex');
var csurf = require('csurf');
var xsrfCookieName = "XSRF-TOKEN";
var xsrfHeaderName = "X-XSRF-TOKEN";
var clientSession = require('client-sessions');

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
		//Relative to projectPath
		cspFile: '/csp.json',
		//File to store csp reports in.
		cspReportsLog : '/cspReports.log',
		//File to store auth reports in.
		authReportsLog : '/authReports.log',
		//Use the JSON prefix countermeasure described in angular docs.
		JSONPrefixing: true,
		//Exclude the '/' route from authentication.
		excludeAuthRoot: true,
		//List of Routes to exclude from authentication.
		excludedAuthRoutes : [],
		//Session (and anti-XSRF token) lifetime in seconds.
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
morgan.token('failedAuth', function(req, res){ 
	return '\n'+req.url+'\n'+util.inspect(req.csession);
});
morgan.token('xsrftoken', function(req, res){ 
	var token = req.get(xsrfHeaderName);
	var tokenCookie = req.cookies[xsrfCookieName];
	return '\n'+"token:"+token+'\n'+"cookie:"+tokenCookie; 
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

//Configure CSP reporting route with the given options.
function configureCspReport(app, opt, cspopt){
	var cspLogPath = path.join(opt["projectPath"],opt["cspReportsLog"]);
	var cspLogStream = fs.createWriteStream(cspLogPath, {flags: 'a'});
	var cspReportParser = bodyParser.json({type: 'application/csp-report'});
	app.post(opt["reportRoute"], cspReportParser, morgan(':date[clf]] :cspreport', {stream : cspLogStream}));
	app.post(opt["reportRoute"], function(req,res){
		//No need to get passed this route after logging.
		res.status(200);
		res.send();
	});
}

function configureAuth(app, opt, exclusionRegex){
		var authLogPath = path.join(opt["projectPath"],opt["authReportsLog"]);
		var authLogStream = fs.createWriteStream(authLogPath, {flags:'a'});
		app.use(exclusionRegex, validateSession(authLogStream));
}

/*
 * Adds an anti-XSRF double submit cookie to the given response.
 */
function setXSRFToken(req,res,next){
	// try{
		// var buf = crypto.randomBytes(256);
		// var randomtoken = buf.toString('base64');
		console.log("SETTING anti XSRF TOKEN");
		// var headerValue = xsrfCookieName +'='+randomtoken+'; Path=/';
		var headerValue = xsrfCookieName +'='+req.csrfToken()+'; Path=/';
		if(res.sae.opt["httpsOnlyCookie"]){
			headerValue += "; Secure";
		}
		res.append('Set-Cookie', headerValue);
		// res.append('X-Forwarded-Proto:', 'https');

	// } catch(ex) { 
	// 	console.log("Entropy sources drained.");
	// 	throw ex;
	// }
		if(next !== undefined){
			next();
		}
}

/*
 * Removes the anti-XSRF double submit from the given response.
 */
function unsetXSRFToken(res){
	var headerValue = xsrfCookieName +'=; Path=/; Max-Age=1';
	if(res.sae.opt["httpsOnlyCookie"]){
		headerValue += "; Secure";
	}
	res.append('Set-Cookie', headerValue);
}

/*
 *	Sends a new client-session with the given session and send data.
 */
function sendNewSession(req, res, sessionData, sendData){
	console.log("newSession");
	//Set session data in req!!!
	//Must explicity use req.cession
	Object.keys(sessionData).forEach(function(name){
		req.csession[name] = sessionData[name];
	});
	req.csession["authenticated"] = true;
	console.log("sending:\n" + util.inspect(req.csession));
	//Set anti-XSRF token
	// console.log("newSession with token:" + req.csrfToken());
	setXSRFToken(req, res, undefined);
	//and send the data.
	console.log("sendData:\n" + util.inspect(sendData));
	res.send(sendData);
}

/*
 * Sends the given data and removes the client-session cookie.
 */
function sendDestroySession(req, res, sendData){
	//Clear XSRF to
	unsetXSRFToken(res);
	//Clear the csession.
	req.csession.reset();
	//And unset the XSRF-token
	res.send(sendData);
}

/*
 * Adds SAE functionality and options to each request/response.
 */
function addSAE(opt){ 
	return function (req, res, next){
		res.sae = {};
		req.sae = {};
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
		if(res.sae.opt["JSONPrefixing"]){
			//TODO:Evaulate if this is needed with anti-XSRF token?
			try {
				JSON.parse(str);
				// console.log("ADDING");
				newStr = ")]}',\n"+str;
			} catch (e) {
				//nop
			}
		}
		console.log("######CSP:\n" + res.get('Content-Security-Policy'));
		//Execute original send();
		sendRef.call(this,newStr);
	};
	next();
}

function validateSession(authLogStream){
	/*
	 * If session + anti XSRF token is valid
	 *	Executes next()
	 * In any other case:
	 *	Execute failedAuthFunction(req, res)
	 */
	return function(req, res, next){
		console.log("#########This url is: " + req.url);
		console.log("#########This path is: " + req.path);
		console.log("csession:\n"+util.inspect(req.csession));
		//If the token was not found within the request or 
		//the value provided does not match the value within the session, 
		//then the request should be aborted, token should be reset and 
		//the event logged as a potential CSRF attack in progress. 
		//
		//Unwrap csession and check authenticated field
		if(req.csession !== undefined && req.csession["authenticated"]){
			//Check anti XSRF token
			var token = req.get(xsrfHeaderName);
			var tokenCookie = req.cookies[xsrfCookieName];
			console.log("Cookie token: "+tokenCookie);
			console.log("Header token: "+token);
			// if(token !== undefined && tokenCookie !==undefined && token === tokenCookie){
				console.log("Token OK");
				//XSRF token OK
				console.log("TRUE");
				//Succesful auth let request go trough.
				continueAuthedRoute(req,res,next);
				return;
			// } else {
			// 	morgan(':date[clf]] :xsrftoken', {stream : authLogStream});
			// }
		}
		//Handle bad request.
		console.log("Auth Failed");
		morgan(':date[clf]] :failedAuth', {stream : authLogStream});
		req.sae.opt.failedAuthFunction(req, res);
		return;	
	};
}

function handleWrongXSRFToken(err, req, res, next) {
	// console.log(util.inspect(err));
	// if(err=== undefined){
	// 	console.log("NEXT!");
	// 	return next();
	// }
	if(err.code !== 'EBADCSRFTOKEN'){
		return next(err);
	}
	console.log("WRONG CSRFTOKEN");
	console.log(util.inspect(err));
	res.status(403);
	res.send('Possible CSRF attack detected.');
}

module.exports = function(myoptions) {
	var def= getDefaults();
	var opt= overrideDefaults(def, myoptions); 
	var secretKeyFile = fs.readFileSync(opt["keyPath"], {encoding:'utf8'});
	var secretKey = secretKeyFile.toString().split("\n")[0];
	console.log(secretKey);
	var csoptions = {
			cookieName : 'csession',
			secret : secretKey,
			duration: opt["sessionLifeTime"]*1000, //duration is in ms
			activeDuration: opt["sessionLifeTime"]*500, // 
			cookie: {
				path:'/',  
				secure: opt["httpsOnlyCookie"],
				httpOnly: true 
			}
	};
	//Add reportRoute to exclusion of routes.
	opt["excludedAuthRoutes"].push(opt["reportRoute"]);
	var exclusionRegex = er.getExclusionRegex(opt["excludeAuthRoot"],opt["excludedAuthRoutes"]);
	// Read csp config file.
	var cspopt;
	var cspFileName = path.join(opt["projectPath"],opt["cspFile"]);
	try{ 
		//Blocking file read needed.
		cspopt = jf.readFileSync(cspFileName);
	} catch (err) {
		//on any error use starter options and report
		console.log("CSP: no proper path provided, using starter options.");
		cspopt = csp.STARTER_OPTIONS;
	}
	var csurfOptions = {
		cookie : {
			// key : xsrfCookieName,
			maxAge : opt["sessionLifeTime"]*1000,
			secure : opt["httpsOnlyCookie"],
			httpOnly: false
		}
		// },
		// value : function (req){
		// 	console.log("token =="+req.get(xsrfHeaderName));
		// 	return req.get(xsrfHeaderName);
		// }
	};
	var xsrf = csurf(csurfOptions);
	return {
		configure: function(app){
			//Add third party middleware first
			//Cookieparser before xsrf
			app.use(cookieParser());
			//report before XSRF check!!
			configureCspReport(app,opt,cspopt);
			app.use(xsrf);
			//Add sae functions and options to requests.
			app.use(addSAE(opt));
			app.use(setXSRFToken);
			app.use(clientSession(csoptions));
			//Add CSP
			app.use(useCSP(cspopt,opt));
			console.log(exclusionRegex);
			//Add session validation
			configureAuth(app,opt,exclusionRegex);
			// app.use(exclusionRegex, validateSession);
		},
		handleErrors: function(app){
			app.use(handleWrongXSRFToken);
		},
		defaults: def,
		options: opt,
		authRoutes: exclusionRegex,
	};
};
