//Requires
var fs = require('fs');
var csp = require('content-security-policy');
var jf = require('jsonfile');
var util = require('util');

//Module specific variables
var defaultCspPath= "/csp.json";

module.exports = function(projectpath) {
	return {
	configure: function(app){
		var cspPolicy = csp.getCSP(csp.STARTER_OPTIONS);
		console.log(util.inspect(this));
		if(typeof this.cspPath === 'undefined'){
			//no cspPath set
			console.log("CSP: no proper policy file provided, using starter options");
			console.log("Using the following CSP:");
			// console.log(util.inspect(cspPolicy()));
			// console.log(util.inspect(cspPolicy));
			console.log(cspPolicy.toString());
			app.use(cspPolicy);
		} else {
			//Read the policy file (created with grunt)
			var file = this.cspPath;
			app.use(csp.getCSP(jf.readFileSync(file)));

			// jf.readFile(file, function(err, obj){
			// 	if (err) {
			// 		//Failed to read it.
			// 		console.log("CSP: File"+file+"non-existant, using starter options.");
			// 		console.log("CSP: Try running grunt with grunt-csp-express to create "+file+".");
			// 		console.log(util.inspect(err));
			// 		//Set starter options.
			// 		console.log("Using the following CSP:");
			// 		// console.log(util.inspect(cspPolicy()));
			// 		console.log(cspPolicy.toString());
			// 		app.use(cspPolicy);
			// 	} else {
			// 		console.log("CSP: using " +file+ " as CSP file.");
			// 		console.log(util.inspect(obj));
			// 		// and set cspPolicy
			// 		cspPolicy = csp.getCSP(obj);
			// 		console.log("Using the following CSP:");
			// 		// console.log(util.inspect(cspPolicy()));
			// 		console.log(cspPolicy.toString());
			// 		console.log(util.inspect(app));
			// 		app.use(cspPolicy);
			// 		console.log(util.inspect(app));
			// 	}
			// });
		}		
	},
	cspPath: projectpath+defaultCspPath,
	getDefaultCspPath: function(){
		return defaultCspPath;
	}
	};
}
