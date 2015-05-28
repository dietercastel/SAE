//REQUIRES
var crypto = require('crypto');
var fs = require('fs');
var csp = require('content-security-policy');
var jf = require('jsonfile');
var util = require('util');
var path = require('path');
var bunyan = require('bunyan');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var er = require('./lib/excluderegex');
var updateCSP = require('./lib/updateCSP');
var pwCheck = require('./lib/pwCheck');
var csurf = require('csurf');
var clientSession = require('client-sessions');
var frameguard = require('frameguard'); 
var dontSniffMIME = require('dont-sniff-mimetype');

//SETTINGS AND OPTIONS RELATED
var xsrfCookieName = "XSRF-TOKEN";
var xsrfHeaderName = "X-XSRF-TOKEN";
var requiredOptions = ["projectPath","keyPath","failedAuthFunction"];
var cspDefaultDirectives = ["default-src", "script-src", "object-src", "style-src", "img-src", "media-src", "frame-src", "font-src", "connect-src" ];

function getDefaults(){
	return { 
		//REQUIRED!!
		projectPath: undefined,
		keyPath: undefined,
		failedAuthFunction: undefined,
		//OPTIONAL
		// CSP OPTIONS:
		//Which route to use for (various e.g. csp) reports.
		//Report route will be excluded from auth by default.
		reportRoute : '/reporting',
		//Use CSP in report-only mode.
		cspReportOnly : false,
		//Prefix to pass through proxy, important for reporting URL.
		proxyPrefix : '', 
		//Csp file to use. Can be generated with grunt-csp-express.
		//Relative to projectPath
		cspFile: '/csp.json',
		//File where updated CSP will be stored.
		newCspFile: '/newcsp.json',
		//File to store csp reports in.
		cspReportsLog : '/cspReports.log',
		// OTHER LOGS
		//File to store auth reports in.
		csessionLog : '/csession.log',
		//Log possibly sensitive data!!
		logSessionData : function(csession){
			return {};
		},
		//File to store xsrf reports in.
		xsrfFailureLog : '/xsrfFailure.log',
		//Exclude the '/' route from authentication.
		excludeAuthRoot: true,
		//List of Routes to exclude from authentication.
		excludedAuthRoutes : [],
		// SESSION OPTIONS
		//Session (and anti-XSRF token) lifetime in seconds.
		sessionIdleTimeout : 1200, //20 minutes
		sessionRefreshTime : 600, //10 minutes
		sessionAbsoluteExpiry : 21600, //6 hours
		//Serve cookies only over https.
		secureCookie : true,
		//Path on which the session cookie is used.
		cookiePath : '/',
		//Full client session options for advanced usage.
		clientSessionsOpt : undefined,
		// ADDITIONAL options. 
		//enables or disables frameguard.
		disableFrameguard : false,
		//Use the JSON prefix countermeasure described in angular docs.
		disableJSONPrefixing: false
	};
}

//BUNYAN LOGGIN SETUP
//Serializers for different logs.
var bunyanReqSerializers = {
	"cspReportsLog": function(req) {
		return req.body["csp-report"];
	},
	"csessionLog": function(req){
		return {
			"protocol" : req.protocol,
			"originalUrl" : req.originalUrl,
			"method" : req.method,
			"headers" : filterNames(req.headers,["cookie"]),
			"cookies" : filterNames(req.cookies,["csession"]),
			"ip" : req.headers['x-forwarded-for'] || req.connection.remoteAddress,
			"body" : req.body,
		};
	},
	"xsrfFailureLog": function(req){
		return {
			"protocol" : req.protocol,
			"originalUrl" : req.originalUrl,
			"method" : req.method,
			"headers" : filterNames(req.headers,["cookie"]),
			"cookies" : filterNames(req.cookies,["csession"]),
			"ip" : req.headers['x-forwarded-for'] || req.connection.remoteAddress,
			"body" : req.body,
			"xsrf-token" : req.get(xsrfHeaderName),
			"tokenCookie" : req.cookies[xsrfCookieName]
		};
	} 
};

/*
 * Function that filters the keys in names out of object.
 */
function filterNames(object, names){
	var result = {};
	Object.keys(object).forEach(function(name){
		if(names.indexOf(name) < 0){
		//name does not occur in names
			result[name] = object[name];
		}
	});
	return result;
}

/*
 * Returns a function that is used for logging csession.
 *
 * extractFunction : Function that returns additional
 *	session data that needs to be logged.
 */
function logSessionDataFunc(extractFunction){
	return function(csession){
		return { logID: csession.csessionLogID,
			expiresAbsolutelyAt : csession.expiresAbsolutelyAt,
			data: extractFunction(csession) 
		};
	};
}

//Returns a new logger of the given type with the given settings
function getBunyanLogger(logType, opt){
	var logPath = path.join(opt["projectPath"],opt[logType]);
	return bunyan.createLogger({
		name: logType, 
		serializers: { req : bunyanReqSerializers[logType], csession: logSessionDataFunc(opt["logSessionData"])},
		streams : [
			{path: logPath}	
		]
	});
}

//VARIOUS
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
		//TODO: generate warnings for insecure settings?
	});
	if(stillRequired.length !== 0 ){
		throw new Error("The following options are required: "+stillRequired);
	}
	return resultObject;
}

//CSP RELATED FUNCTIONS
/*
 * Configure and return the content-security-policy middleware.
 */
function useCSP(cspopt, opt, env){
	cspopt["report-uri"] = opt["proxyPrefix"] + opt["reportRoute"];
	cspopt["report-only"] = opt["cspReportOnly"];
	console.log("CSP: using following configuration:");
	console.log(util.inspect(cspopt));
	if(opt["cspReportOnly"] && (env !== 'testing' || env !== 'development')){
		console.log("WARNINNG: CSP report-only mode on! This is NOT recommended in a production environment!");
	}
	return csp.getCSP(cspopt);
}

/*
 * Configure CSP reporting route with the given options.
 */
function configureCspReport(app, opt, cspopt){
	var cspReportLogger = getBunyanLogger("cspReportsLog", opt);
	var cspReportParser = bodyParser.json({type: function(req){
		if(req.get('content-type') === 'application/csp-report'){
			return true;	
		}
		if(req.get('content-type') === 'application/json'){
			return true;
		}
		return false;
	}});
	app.post(opt["reportRoute"], cspReportParser);
	app.post(opt["reportRoute"], function(req, res, next){
		cspReportLogger.info({req: req, env: app.get('env')}, "Received CSP report.");
		next();
	});
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
function configureAuth(app, authLogger, exclusionRegex){
}

/*
 *	Sends a new client-session with the given session and send data.
 *	Also logs the "create" event.
 */
function sendNewSession(req, res, sessionData, sendData){
	if(req.method !== "POST"){
		throw new Error("Starting a new session with sendNewSession should always be done with a POST request.");
	}
	//Clear csession explicitly
	req.csession.reset();
	//Set session data in req!!!
	//Must explicity use req.cession
	Object.keys(sessionData).forEach(function(name){
		req.csession[name] = sessionData[name];
	});
	req.csession["expiresAbsolutelyAt"] = Date.now() + req.sae.opt["sessionAbsoluteExpiry"]*1000;
	req.csession["csessionLogID"] = Math.random();
	//Reset XSRF token is done autmatically on each request.
	//and send the data.
	var logObject = { //Filtered with serializers.
		eventType : "create",
		csession: req.csession,
		req: req
	};
	res.sae.authLogger.info(logObject, "Created new csession.");
	res.send(sendData);
}

/*
 * Sends the given data and removes the client-session cookie.
 *	Also logs the "destroy" event.
 */
function sendDestroySession(req, res, sendData){
	if(req.method !== "POST"){
		throw new Error("Destroying a session with sendDestroySession should always be done with a POST request.");
	}
	//XSRF token reset is done automatically on each request!
	var logObject = { //Filtered with serializers.
		eventType : "destroy",
		csession: req.csession,
		req: req
	};
	res.sae.authLogger.info(logObject, "Destroying session!");
	req.csession.reset();
	res.send(sendData);
}

/*
 * Adds SAE functionality and options to each request/response.
 */
function addSAE(opt, authLogger){ 
	return function (req, res, next){
		res.sae = {};
		req.sae = {};
		req.sae.opt = res.sae.opt = opt;
		res.sae.sendNewSession = sendNewSession;
		res.sae.sendDestroySession = sendDestroySession;
		res.sae.authLogger = authLogger;
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
		if(!res.sae.opt["disableJSONPrefixing"]){
			try {
				JSON.parse(str);
				newStr = ")]}',\n"+str;
			} catch (e) {
				//nop
			}
		}
		//TODO: check 
		console.log("######CSP:\n" + res.get('Content-Security-Policy'));
		//Execute original send();
		// Test this
		// if(res.get('Set-Cookie').length > 4000){
		// 	console.log("WARNING: cookie is close to exceeding common size limit");
		// }
		sendRef.call(this,newStr);
	};
	next();
}


/*
 * Provides support for Internet Explor's divergent CSP headers.
 */
function provideIECSPHeaders(req, res, next){
	var csp = res.get('Content-Security-Policy');
	var reportCsp = res.get('Content-Security-Policy-Report-Only');
	if(csp !== undefined){
		res.set('X-Content-Security-Policy', csp);
	}
	if(reportCsp !== undefined){
		res.set('X-Content-Security-Policy-Report-Only', reportCsp);
	}
	next();
}

/*
 * Returns a session validation function that logs to the given stream.
 */
function validateSession(authLogger){
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
			var logObject = { //Filtered with serializers.
				eventType : "update",
				csession: req.csession,
				req: req
			};
			authLogger.info(logObject, "Authentication successful!");
			continueAuthedRoute(req,res,next);
			return;
		}
		//Handle bad request.
		console.log("Auth Failed");
		var logObject = { //Filtered with serializers.
			eventType : "failure",
			csession: req.csession,
			req: req
		};
		authLogger.info(logObject, "Authentication failed!");
		req.sae.opt.failedAuthFunction(req, res);
		return;	
	};
}

/*
 * Returns an xsrf error handling function with the given log stream.
 */
function handleWrongXSRFToken(xsrfLogger){
	/* 
	 * Handles a wrong XSRF token error thrown by csurf:
	 *
	 * If the token was not found within the request or 
	 * the value provided does not match the value within the session, 
	 * then the request should be aborted, token sould be reset and 
	 * the event logged as a potential CSRF attack in progress. 
	 */
	return function(err, req, res, next) {
		if(err.code !== 'EBADCSRFTOKEN'){
			return next(err);
		}
		//Log potential xsrf attack
		xsrfLogger.error({req: req}, "Potential XSRF attack!!");
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

/*
 * Checks if secret is sufficiently long and strong with pwCheck
 * Raises error's if it's not.
 */
function checkSecretKey(secretKey){
	if(secretKey === undefined){
		throw new Error("Can't find a secret to use. Check the keyPath option of SAE and verify the file you specify exists.");
	}
	if(!pwCheck.isValid(secretKey)){
		throw new Error("The secret you used is not valid. It must be at LEAST 16 charachters long and include at least two words (letter sequences separated by a non-letter sequence).");
	}
}

module.exports = function(myoptions) {
	var def= getDefaults();
	var opt= overrideDefaults(def, myoptions); 
	var secretKeyFile = fs.readFileSync(opt["keyPath"], {encoding:'utf8'});
	var secretKey = secretKeyFile.toString().split("\n")[0];
	checkSecretKey(secretKey);
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
		console.log("CSP: no proper path provided, using default options.");
		cspopt = {};
		cspDefaultDirectives.forEach(function(directivename){
			cspopt[directivename] = csp.SRC_NONE;
		});
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
	var authLogger = getBunyanLogger("csessionLog",opt);
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
			app.use(addSAE(opt, authLogger));
			app.use(setXSRFToken);
			//Provide client session options
			app.use(clientSession(csoptions));
			//Add CSP
			app.use(useCSP(cspopt,opt, app.get('env')));
			app.use(provideIECSPHeaders);
			console.log(exclusionRegex);
			//Add session validation, check csession is populated
			app.use(exclusionRegex, validateSession(authLogger));
		},
		handleErrors: function(app){
			var xsrfLogger = getBunyanLogger("xsrfFailureLog", opt);
			xsrfLogger.level("error");
			app.use(handleWrongXSRFToken(xsrfLogger));
		},
		defaults: def,
		options: opt,
		authRoutes: exclusionRegex,
	};
};
