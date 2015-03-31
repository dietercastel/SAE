//Requires
var fs = require('fs');
var csp = require('content-security-policy');
var jf = require('jsonfile');
var util = require('util');
var path = require('path');
var morgan = require('morgan');

//SETTINGS AND OPTIONS RELATED
var requiredOptions = ["projectPath"];
function getDefaults(){
	return { 
		reportRoute : '/reporting',
		proxyPrefix : '', 
		cspFile: '/csp.json',
		cspReports : '/cspReports.log',
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
	cspopt["report-uri"] = opt["proxyPrefix"] + opt["reportRoute"];
	console.log("CSP: using following configuration:");
	console.log(util.inspect(cspopt));
	return csp.getCSP(cspopt);
}

function configureCsp(app, bodyParser, opt){
	var cspLogPath = path.join(opt["projectPath"],opt["cspReports"]);
	var cspLogStream = fs.createWriteStream(cspLogPath, {flags: 'a'})
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

module.exports = function(myoptions) {
	var def= getDefaults();
	var opt= overrideDefaults(def, myoptions); 
	return {
		configure: function(app,bodyParser){
			configureCsp(app,bodyParser,opt);
		},
			defaults: def,
			options: opt 
	};
};
