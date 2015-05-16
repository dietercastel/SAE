//REQUIRES
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
var updateCSP = require('./lib/updateCSP');
var csurf = require('csurf');
var clientSession = require('client-sessions');
var frameguard = require('frameguard'); 
var dontSniffMIME = require('dont-sniff-mimetype');

//SETTINGS AND OPTIONS RELATED
var xsrfCookieName = "XSRF-TOKEN";
var xsrfHeaderName = "X-XSRF-TOKEN";
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
		newCspFile: '/newcsp.json',
		//File to store csp reports in.
		cspReportsLog : '/cspReports.log',
		//File to store auth reports in.
		authReportsLog : '/authReports.log',
		//File to store xsrf reports in.
		xsrfReportsLog : '/xsrfReports.log',
		//Use the JSON prefix countermeasure described in angular docs.
		JSONPrefixing: true,
		//Exclude the '/' route from authentication.
		excludeAuthRoot: true,
		//List of Routes to exclude from authentication.
		excludedAuthRoutes : [],
		//Session (and anti-XSRF token) lifetime in seconds.
		sessionIdleTimeout : 1200, //20 minutes
		sessionRefreshTime : 600, //10 minutes
		sessionAbsoluteExpiry : 43200, //12 hours
		//enables or disables frameguard.
		disableFrameguard : false,
		//Serve cookies only over https
		//How does this interact with proxy/other settings?
		secureCookie : true,
		cookiePath : '/',
		clientSessionsOpt : undefined
	};
}

/*
 * Returns a log stream of the given type with the given options. 
 */
function getLogStream(logType, opt){
	var logPath = path.join(opt["projectPath"],opt[logType]);
	return  fs.createWriteStream(logPath, {flags: 'a'});
}

/* 
 * Overrides the default options with the user supplied options.
 * Throws an error if not all required options are provided.
 */ 
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

//MORGAN LOGGING SETUP
//Custom :cspreport logging token with morgan
morgan.token('cspreport', function(req, res){ 
	return '\n'+util.inspect(req.body["csp-report"]).toString(); 
});
//Custom :failedAuth logging token with morgan
morgan.token('failedAuth', function(req, res){ 
	return '\n'+req.url+'\n'+util.inspect(req.csession);
});
//Custom :xsrftoken logging token with morgan
morgan.token('xsrftoken', function(req, res){ 
	var token = req.get(xsrfHeaderName);
	var tokenCookie = req.cookies[xsrfCookieName];
	return '\n'+"token:"+token+'\n'+"cookie:"+tokenCookie; 
});

//CSP RELATED FUNCTIONS
/*
 * Configure and return the content-security-policy middleware.
 */
function useCSP(cspopt,opt){
	cspopt["report-uri"] = opt["proxyPrefix"] + opt["reportRoute"];
	cspopt["report-only"] = opt["cspReportOnly"];
	console.log("CSP: using following configuration:");
	console.log(util.inspect(cspopt));
	if(opt["cspReportOnly"]){
		console.log("CSP: Report only mode on. This is NOT recommended.");
	}
	return csp.getCSP(cspopt);
}

/*
 * Configure CSP reporting route with the given options.
 */
function configureCspReport(app, opt, cspopt){
	var cspLogStream = getLogStream("cspReportsLog", opt);
	var cspReportParser = bodyParser.json({type: 'application/csp-report'});
	app.post(opt["reportRoute"], cspReportParser);
	app.post(opt["reportRoute"], morgan('{ "time": :date[clf], "data": :cspreport} ', {stream : cspLogStream}));
	console.log(app.get('env'));
	
	var cspup = updateCSP({
		"env" : app.get('env'),
		"filename" : path.join(opt["projectPath"],opt["newCspFile"])
	});

	app.post(opt["reportRoute"], cspup);
	app.post(opt["reportRoute"], function(req,res){
		//No need to get passed this route after processing.
		res.status(200);
		res.send();
	});
}

//XSRF RELATED FUNCTIONS

/*
 * Adds an anti-XSRF double submit cookie to the given response.
 */
function setXSRFToken(req,res,next){
	console.log("SETTING anti XSRF TOKEN");
	//Set the cookie so angular.js can read the token.
	var headerValue = xsrfCookieName +'='+req.csrfToken()+'; Path=/';
	if(res.sae.opt["secureCookie"]){
		headerValue += "; Secure";
	}
	res.append('Set-Cookie', headerValue);
	// res.append('X-Forwarded-Proto:', 'https');
	if(next !== undefined){
		next();
	}
}

//SESSION RELATED FUNCTIONS

/*
 * Configures the authentication with the given options.
 */
function configureAuth(app, opt, exclusionRegex){
		var authLogStream = getLogStream("authReportsLog",opt);
		app.use(exclusionRegex, validateSession(authLogStream));
}

/*
 *	Sends a new client-session with the given session and send data.
 */
function sendNewSession(req, res, sessionData, sendData){
	if(req.method !== "POST"){
		throw new Error("Starting a new session with sendNewSession should always be done with a POST request.");
	}
	console.log(req.method);
	console.log("newSession");
	//Clear csession explicitly
	req.csession.reset();
	//Set session data in req!!!
	//Must explicity use req.cession
	Object.keys(sessionData).forEach(function(name){
		req.csession[name] = sessionData[name];
	});
	req.csession["expiresAbsolutelyAt"] = Date.now() + req.sae.opt["sessionAbsoluteExpiry"]*1000;
	console.log("sending:\n" + util.inspect(req.csession));
	//Reset XSRF token is done autmatically on each request.
	//and send the data.
	console.log("sendData:\n" + util.inspect(sendData));
	res.send(sendData);
}

/*
 * Sends the given data and removes the client-session cookie.
 */
function sendDestroySession(req, res, sendData){
	if(req.method !== "POST"){
		throw new Error("Destroying a session with sendDestroySession should always be done with a POST request.");
	}
	//Reset XSRF token is done autmatically on each request.
	console.log(req.route.method);
	console.log("csession before" + util.inspect(req.csession));
	req.csession.reset();
	console.log("csession after" + util.inspect(req.csession));
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
 *	An finally the normal send function is executed.
 *
 * After send is overwritten continue with next()
 */
function continueAuthedRoute(req, res, next){
	var sendRef = res.send;
	res.send = function(str){
		var newStr = str;
		if(res.sae.opt["JSONPrefixing"]){
			try {
				JSON.parse(str);
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

/*
 * Returns a session validation function that logs to the given stream.
 */
function validateSession(authLogStream){
	/*
	 * If session is valid
	 *	Executes next()
	 * In any other case:
	 *	Execute failedAuthFunction(req, res)
	 */
	return function(req, res, next){
		console.log("XSRF Token OK");
		console.log("#########This url is: " + req.url);
		console.log("#########This path is: " + req.path);
		console.log("csession:\n"+util.inspect(req.csession));
		//Unwrap csession and check absolute expiry field
		if(req.csession !== undefined && Date.now() <= req.csession["expiresAbsolutelyAt"]){
			console.log("Authenticated request.");
			//Succesful auth let request go trough.
			continueAuthedRoute(req,res,next);
			return;
		}
		//Handle bad request.
		console.log("Auth Failed");
		morgan(':date[clf]] :failedAuth', {stream : authLogStream});
		req.sae.opt.failedAuthFunction(req, res);
		return;	
	};
}

/*
 * Returns an xsrf error handling function with the given log stream.
 */
function handleWrongXSRFToken(xsrfLogStream){
	/* 
	 * Handles a wrong XSRF token error thrown by csurf:
	 *
	 * If the token was not found within the request or 
	 * the value provided does not match the value within the session, 
	 * then the request should be aborted, token shhttp://www.theonion.com/articles/hillary-clinton-to-nation-do-not-fuck-this-up-for,38416/ould be reset and 
	 * the event logged as a potential CSRF attack in progress. 
	 */
	return function(err, req, res, next) {
		if(err.code !== 'EBADCSRFTOKEN'){
			return next(err);
		}
		//Log potential xsrf attack
		morgan(':date[clf]] :xsrftoken', {stream : xsrfLogStream});
		console.log("WRONG CSRFTOKEN");
		console.log(util.inspect(err));
		//Reset XSRF token is done autmatically on each request.
		res.status(403);
		res.send('Possible CSRF attack detected.');
	};
}

/*
 * Configures frameguard with the given options.
 */
function configureFrameguard(app, cspopt, opt){
	if(!opt["disableFrameguard"] && cspopt["frame-src"] === undefined){
		app.use(frameguard('deny'));
	}
}

module.exports = function(myoptions) {
	var def= getDefaults();
	var opt= overrideDefaults(def, myoptions); 
	var secretKeyFile = fs.readFileSync(opt["keyPath"], {encoding:'utf8'});
	var secretKey = secretKeyFile.toString().split("\n")[0];
	console.log(secretKey);
	var csoptions;
	if(opt["clientSessionsOpt"] !== undefined){
		csoptions = opt["clientSessionsOpt"];
	} else {
		csoptions = {
			cookieName : 'csession',
			secret : secretKey,
			duration: opt["sessionIdleTimeout"]*1000, //duration is in ms
			activeDuration: opt["sessionRefreshTime"]*1000, 
			cookie: {
				path: opt["cookiePath"],  
				secure: opt["secureCookie"],
				httpOnly: true,
				ephemeral: true //make it a session cookie
			}
		};
	}
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

	newCSP = cspopt;
	newCspFileName = path.join(opt["projectPath"],opt["newCspFile"]);
	jf.writeFileSync(newCspFileName, newCSP);

	var csurfOptions = {
		cookie : {
			maxAge : opt["sessionIdleTimeout"]*1000,
			secure : opt["secureCookie"],
			httpOnly: true
		},
		value : function (req){
			console.log("token =="+req.get(xsrfHeaderName));
			return req.get(xsrfHeaderName);
		}
	};
	var xsrf = csurf(csurfOptions);
	return {
		configure: function(app){
			//Add third party middleware first
			app.disable('x-powered-by');
			app.use(dontSniffMIME());
			configureFrameguard(app, cspopt, opt);
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
		},
		handleErrors: function(app){
			var xsrfLogStream = getLogStream("xsrfReportsLog", opt);
			app.use(handleWrongXSRFToken(xsrfLogStream));
		},
		defaults: def,
		options: opt,
		authRoutes: exclusionRegex,
	};
};
