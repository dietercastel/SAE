/**
 * Builds a string representing the part of the regex that
 * describes all the excluded Routes. Takes excluding the
 * root path and an empty array into account.
 */
function getExcludedRoutesString(excludeRoot, excludedRoutes){
	//Backslash needs escaping twice
	var startString = "|(\\\/){0,2}";
	var resultString = "";
	var length =excludedRoutes.length;
	if(length < 1){
		//Only exclude an empty string.
		return "$";	
	}
	var sanitizedRoutes = sanitizeRoutes(excludedRoutes);
	for(var i=0; i < length;  i++){
		resultString += startString + sanitizedRoutes[i];
	}
	if(!excludeRoot){
		return resultString.substr(1,resultString.length);
	}
	return resultString;
}

function sanitizeRoute(route){
	return route.replace(/^\/+/g, '');
}

function sanitizeRoutes(excludedRoutes){
	return excludedRoutes.map(sanitizeRoute);
}

module.exports = {
	/*
	 * Returns a regex that excludes the root path ('/') and/or the
	 *	given routes. 
	 *
	 * @param {boolean} excludeRoot 
	 *	Determins whether the root route ('/') is excluded.
	 * @param {string[]} excludedRoutes
	 *	The routes that will be excluded. Leading slash(es)
	 *	will be removed.
	 * @returns {RegExp}
	 *	A regex that excludes the root route and or other given
	 *	routes. e.g. if "notthis" is given, routes like:
	 *	"//notthis","/notthis","/notthis/anything/here"
	 *	are ALL excluded.
	 */
	getExclusionRegex: function(excludeRoot, excludedRoutes){
			var length = excludedRoutes.length;
			// Building regex similar to this:
			// /^(?!\/$|(\/)?notthis(\/.*)*$|(\/)?orthis(\/.*)*$).+/i
			var startString = "^(?!";
			var endString = ").+"
			//Backslash needs escaping twice
			var excludeRootString = "(\\\/)\{0,2\}\$";
			var excludedRoutesString = getExcludedRoutesString(excludeRoot, excludedRoutes);
			var resultString;
			if(excludeRoot){
				resultString = startString + excludeRootString + excludedRoutesString + endString;
			} else {
				resultString = startString + excludedRoutesString + endString;
			}
			//Global and case insensitive
			return new RegExp(resultString, "i");
	},
	sanitizeRoutes: sanitizeRoutes
}
