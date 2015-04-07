//Requires
var crypto = require('crypto');
var fs = require('fs');
var csp = require('content-security-policy');
var jf = require('jsonfile');
var util = require('util');
var path = require('path');
var morgan = require('morgan');
var cookieParser = require('cookie-parser');

//SETTINGS AND OPTIONS RELATED
var requiredOptions = ["projectPath"];
function getDefaults(){
	return { 
		reportRoute : '/reporting',
		reportOnly : false,
		proxyPrefix : '', 
		cspFile: '/csp.json',
		cspReports : '/cspReports.log',
		useJSONPCM: true,
		projectPath: undefined
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
	cspopt["report-only"] = opt["reportOnly"];
	console.log("CSP: using following configuration:");
	console.log(util.inspect(cspopt));
	if(opt["reportOnly"]){
		console.log("CSP: Report only mode on. This is NOT recommended.");
	}
	return csp.getCSP(cspopt);
}

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
function setXSRFToken(){
	//TODO make a real random token.
	// var randomtoken = "NOTARANDOMTOKEN";
	try{
		var buf = crypto.randomBytes(256);
		var randomtoken = buf.toString('base64');
		console.log("SETTING anti XSRF TOKEN");
		return this.append('Set-Cookie', 'XSRF-TOKEN='+randomtoken+'; Path=/');
	} catch(ex) { 
		console.log("Entropy sources drained.");
		throw ex;
	}
}

// Implementation for anti XSRF/CSRF double submit cookie.
function unsetXSRFToken(){
	//TODO
	console.log("UNSETTING anti XSRF TOKEN");
}


//If the token was not found within the request or the value provided does not match the value within the session, then the request should be aborted, token should be reset and the event logged as a potential CSRF attack in progress. 
/*
 * Returns 
 *	False if the request doesn't have a valid
 *		XSRF token set.
 *	True if the token is valid.
 */
function validateXSRFToken(res, validFunction, invalidFunction){
	var token = this.get('X-XSRF-TOKEN');
	var tokenCookie = this.cookies["XSRF-TOKEN"];
	console.log("Header token: "+token);
	console.log("Cookie token: "+tokenCookie);
	if(token === undefined || tokenCookie ===undefined){
		console.log("FALSE");
		invalidFunction(res);
		return;
	}
	if(token === tokenCookie){
		console.log("TRUE");
		validFunction(this, this.next);
		return;	
	}
	console.log("FALSE");
	invalidFunction(res);
	return;
}


//MISC
//This function intercepts res.send()
//When a json body is about to be send
//The countermeasure string ")]}',\n" is added in front of it
//then the normal send function is executed.
function addJSONPCM(req, res, next){
	var sendRef = res.send;
	res.send = function(str){
		var newStr = str;
		try {
			JSON.parse(str);
			// console.log("ADDING");
			newStr = ")]}',\n"+str;
		} catch (e) {
			//nop
		}
		// console.log(newStr);
		sendRef.call(this,newStr);
	};
	next();
}

function addFuctions(req, res, next){
	req.valToken = validateXSRFToken;
	res.setToken = setXSRFToken;
	next();
}

module.exports = function(myoptions) {
	var def= getDefaults();
	var opt= overrideDefaults(def, myoptions); 
	return {
		configure: function(app,bodyParser){
			app.use(cookieParser());
			app.use(addJSONPCM);
			app.use(addFuctions);
			configureCsp(app,bodyParser,opt);
		},
			defaults: def,
			options: opt
	};
};
