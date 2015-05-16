var async = require('async');
var jf = require('jsonfile');
var util = require('util');
var cspReportProcessingQueue = async.queue(cspUpdater, 1);

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
		var newArr;
		//can be a single string or array!!
		if(typeof newCSP[directive] === "string"){
			newArr = [newCSP[directive]];
		} else {
			newArr = newCSP[directive];
		}
		async.series([
				function(callb){
					console.log(newArr);
					//Not already in the list
					if(newArr.indexOf(uri) < 0){
						newArr.push(uri);
					}
					console.log("newArr == " + newArr);
					newCSP[directive] = newArr;
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
		if(req.body["csp-report"] === undefined){
			throw new Error("No valid csp-report in the request. Check whether you parse the csp-report correctly with bodyParser!");
		}
		var report = req.body["csp-report"];
		//Only allow new CSP building in development?
		if(options['env'] === "development"){
			console.log("DEVELOPMENT");
			//Only support actual uri's NOTHING INLINE!!
			if(report['blocked-uri'] !== ''){
				console.log("NOT EMPTY");
				var tsk = {
					"filename"	: options["filename"],
					"directive" : report['effective-directive'],
					"uri" : report['blocked-uri']
				}
				cspReportProcessingQueue.push(tsk, function(){
					console.log("FINISHED TSK:" + util.inspect(tsk));
				});
			}
		}
		next();
	};
}
