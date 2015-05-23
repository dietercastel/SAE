var async = require('async');
var jf = require('jsonfile');
var util = require('util');
var cspReportProcessingQueue = async.queue(cspUpdater, 1);

var httpRegex=/http:\/\/[a-z0-9-]+((\.[a-z0-9-]+)*)+(:[0-9]+)?(\/)?/i; 
var httpsRegex=/https:\/\/[a-z0-9-]+((\.[a-z0-9-]+)*)+(:[0-9]+)?(\/)?/i; 

/*
 * Worker for the csp-report processing queue.
 *
 * Reads the existing new csp file,
 * updates the appropriate directive,
 * filter doubles of that directive
 * and write the result back to the file.
 */
function cspUpdater(task, callback){
	var fileName = task.filename;
	var directive = task.directive;
	var uri = task.uri;

	jf.readFile(fileName, function(err, newCSP){
		console.log(util.inspect(newCSP[directive]));
		var uriArg;
		//Can be a single string or array!!
		if(typeof newCSP[directive] === "string"){
			//Space needed in case of string.
			uriArg = " "+uri;
		} else if(Array.isArray(newCSP[directive])){
			//Just the uri needed in case of Array.
			uriArg = uri; 
		} else {
			//Empty directive create either string or array.
			uriArg = uri; 
			newCSP[directive] = [uri]; 
		}
		async.series([
				function(callb){
					console.log("before: "+ newCSP[directive]);
					//Not already in the string/array 
					if(newCSP[directive].indexOf(uri) < 0){
						//Concat to string/array
						newCSP[directive] = newCSP[directive].concat(uriArg);
					}
					console.log("after: " + newCSP[directive]);
					//When adding is done, go next call for writing.
					callb(null, newCSP[directive]);
				},
				function(callb){
					jf.writeFile(fileName, newCSP, function(err) {
						console.log(err);
						callb(null, 'done');
					});
				}
		],
		function(err, results){
			console.log(results);
			callback();
		});
	});
}


module.exports = function(options){
	/*
	 * Returns middleware that queues csp-reports for processing.
	 *
	 * Expects parsing of the report to be done in advance with
	 *	bodyParser.json({type: 'application/csp-report'});
	 * Only works in a development environment.
	 * Only supports none-inline resources!
	 */
	return function(req, res, next){
		console.log("++++++++++++++++++++++++++++++++++++++++++");
		if(req.body["csp-report"] !== undefined){
			var report = req.body["csp-report"];
			//Only allow new CSP building in development?
			if(options['env'] === "development"){
				console.log("DEVELOPMENT");
				var tsk = {
					"filename"	: options["filename"],
				}
				//Only support actual uri's NOTHING INLINE!!
				//	On inline chrome sends ""
				//	On other blocked-uri = base url
				//	On inline firefox sends "self"
				//	On other blocked-uri = full url 
				var httpsRes = report['blocked-uri'].match(httpsRegex);
				var httpRes = report['blocked-uri'].match(httpRegex);
				console.log(httpsRes);
				console.log(httpRes);
				if(httpsRes !== null){
					//First match is base URL.
					tsk["uri"] = httpsRes[0]; 
				} else if(httpRes !== null){
					//First match is base URL.
					tsk["uri"] = httpRes[0];
				}
				if(tsk["uri"] !== undefined){
					if(report['effective-directive'] !==undefined){ 
						//Chrome
						tsk["directive"] = report['effective-directive'];
					} else { 
						//Firefox
						tsk["directive"] = report["violated-directive"].split(" ")[0];
					} 
					console.log(util.inspect(tsk));
					cspReportProcessingQueue.push(tsk, function(){
						console.log("FINISHED TSK:" + util.inspect(tsk));
					});
				}
			}
			next();
		} else {
			console.log("No valid csp-report in the request. Check whether you parse the csp-report correctly with bodyParser!");
		}
	};
}
