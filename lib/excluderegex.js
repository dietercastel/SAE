function getExcludedRoutesString(excludeRoot, excludedRoutes){
	//Backslash needs escaping twice
	var startString = "|(\\\/){0,2}";
	var endString= "(\\\/.*)*$";
	var resultString = "";
	var length =excludedRoutes.length;
	if(length < 1){
		return resultString;	
	}
	for(var i=0; i < length;  i++){
		resultString += startString + excludedRoutes[i].replace(/^\/+/g, '');	+ endString;
	}
	if(!excludeRoot){
		return resultString.substr(1,resultString.length);
	}
	return resultString;
}

module.exports = {
	/*
	 * @excludedRoutes routes should be given without any leading / (or //).
	 */
	getExclusionRegex: function(excludeRoot, excludedRoutes){
			var length = excludedRoutes.length;
			// Building regex similar to this:
			// /^(?!\/$|(\/)?notthis(\/.*)*$|(\/)?orthis(\/.*)*$).+/ig
			var startString = "^(?!";
			var endString = ").+"
			//Backslash needs escaping twice
			var excludeRootString = "\\\/$";
			var excludedRoutesString = getExcludedRoutesString(excludeRoot, excludedRoutes);
			var resultString;
			if(excludeRoot){
				resultString = startString + excludeRootString + excludedRoutesString + endString;
			} else {
				resultString = startString + excludedRoutesString + endString;
			}
			//Global and case insensitive
			return new RegExp(resultString, "gi");
		}
}
