/*
 * Small strength-password checking module that follows the guidelines suggested by
 * "Can Long Passwords Be Secure and Usable?" (R. Shay et alii, 2014).
 * More specifically it follows their 2word16 guideline:
 * "These passwords required at least 16 characters and needed to include 
 *	at least two words (letter sequences separated by a non-letter sequence)."
 *
 */

var badregex = /(^([^a-z]*)([a-z]*)([^a-z]*)$)|(^([a-z]*)([^a-z]*)$)/i;

module.exports = {
	isValid: function(pwtocheck){
		if(pwtocheck ===undefined){
			return false;	
		}
		if(typeof pwtocheck !== "string"){
			return false;	
		}
		if(pwtocheck.length < 16){
			return false;	
		}
		if(badregex.test(pwtocheck)){
			return false;	
		}
		return true;
	}
}
