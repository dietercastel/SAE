'use strict';
var grunt = require('grunt');
var pwc = require('../lib/pwCheck');

/*
   ======== A Handy Little Nodeunit Reference ========
   https://github.com/caolan/nodeunit

   Test methods:
   test.expect(numAssertions)
   test.done()
   Test assertions:
   test.ok(value, [message])
   test.equal(actual, expected, [message])
   test.notEqual(actual, expected, [message])
   test.deepEqual(actual, expected, [message])
   test.notDeepEqual(actual, expected, [message])
   test.strictEqual(actual, expected, [message])
   test.notStrictEqual(actual, expected, [message])
   test.throws(block, [error], [message])
   test.doesNotThrow(block, [error], [message])
   test.ifError(value)
   */

exports.excluderegex = {
	setUp: function(done) {
		done();
	},
	obvioustest: function(test){
		test.expect(2);
		var t = [1,1];
		t.forEach(function(item){
			test.equal(item,1, "1 === 1 for sure although it might be hard to prove.");
		});
		test.done();
	},
	undef: function(test) {
		test.expect(1);
		test.ok(!pwc.isValid(undefined), "The value 'undefined' should be rejected.");
		test.done();
	},
	tooshort : function(test){
		var testarray = ["", //0
			"8", //1, ... 
			"Nb",
			"3UN",
			"Xadb",
			"1kLms",
			"9whphR",
			"oU2MgAX",
			"sM03ldMN",
			"GKBkwKxt5",
			"8xcgOKXBrc",
			"W1qYbXWlUyI",
			"x1jbT6KcEqFQ",
			"jEkmA58zXrboW",
			"mCMmbgmRNgNdS9", //14,
			"sGIer8GBnRasUw2", //15
			"Banana error."]; 
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(!pwc.isValid(pw), "The value +'"+pw+"' should be rejected since its length is only " + pw.length);
		});
		test.done();
	},
	onlyletters: function(test){
		var testarray = ["gsOaewzjnYFMuqyK",
			"zDxFqcGIVpCoLQxsf",
			"GHTSCtNJNLYwqBCQnT",
			"iivtWXGXLrFvqWBEPiX",
			"YoyIwBGgkeJDVYCGPwdt",
			"SHfTFFoWscTUfLIBXmt",
			"DJmxNkVAzUninXOXxB",
			"OmzrxwwxUooynjmcudJM",
			"bftePHPxCPUccGXyp",
			"juzUPBMUCrghgxgauMhG"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(!pwc.isValid(pw), "The value +'"+pw+"' should be rejected since has only letters.");
		});
		test.done();
	},
	onlynumbers: function(test){
		var testarray = ["3765374939005203",
			"09423186969465090",
			"142452476375515872",
			"9230746866330644285",
			"76878317845649253576",
			"28151150515791991870",
			"302405853264100804",
			"42355512676027515957",
			"25575890625763405",
			"77738804974838003572"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(!pwc.isValid(pw), "The value +'"+pw+"' should be rejected since has only numbers.");
		});
		test.done();
	},
	onlyoneword: function(test){
		var testarray = [ "iVfmQbGYjDKlVrl63501",
			"3688UWiWTzFxxkYcJDnV",
			"BiaBGsWWNFFVtdZXTNfg",
			"51ZbdTntAMKhSMv552",
			"tPWfjULiqEdhkjKUkl33",
			"sQTajMLYeStaNDbNyMnr",
			"8302305487IMWFWaAW",
			"L0123456789101112131",
			"1abcdefghijklmnopq23",
			"zuvw6703731113805"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(!pwc.isValid(pw), "The value +'"+pw+"' should be rejected since has only one 'word'.");
		});
		test.done();
	},
	simplevalids : function(test){
		var testarray = ["aaaaaaaaaaa bbbbbbbbbb",
		"ffffffff123bbbbbbbbb",
		"f2f2f2f2f2f2f2f22ff2",
		"333f3f3f3f3f3f3f3f3f333",
		"1aaaaaaaaaa;bbbbbbbb1",
		"11aaaaaaaaaaaaaaa8bb",
		";;;;;;;BCD:::::AAAAAAA"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(pwc.isValid(pw), "The value +'"+pw+"' should be accepted.");
		});
		test.done();
	},
	sixteenlength : function(test){
		var testarray = ["A1AAAAAAAAAAAAAA",
		"A11AAAAAAAAAAAAA",
		"AA11AAAAAAAAAAAA",
		"AAA11AAAAAAAAAAA",
		"AAA11A11AAAAAAAA",
		"AAAAAA11AAAAAAAA",
		"1AAAAA11AAAAAAAA",
		"1AAAAA11AAAAAAA1",
		"1AAAAA11AAAAAA11",
		"111AAA11AAAAA111",
		"11111A11A1111111",
		"AAAAAA11A1111111",
		"AAAAAA11AAAAAAA1",
		"AAAAAAA11AAAAAA1",
		"AAAAAAAA11AAAAA1",
		"AAAAAAAAA11AAAA1"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(pwc.isValid(pw), "The value +'"+pw+"' should be accepted.");
		});
		test.done();
	},
	randomtwentylongs : function(test){
		var testarray = ["ZphNvhkDR8s3cDbM3WNS",
		"rxNbXyd2phht8Jdk3Kti",
		"7ux77PVwLtRvBvqiaP6Q",
		"kKEvBf8oAjUIhofY0xJF",
		"MEeXOcBp18ZAcvsmEwys",
		"0xm5MbZn0WJ1ALG9yRl9",
		"GulAlCxQZ7tPRy4tUb7W",
		"vHpD5k8ACsGzpdAgkhrc",
		"oJ0aJQO9PPPg40l9d3pk",
		"wRjgQd21YIHUn36Ai1lU",
		"b0AKdsbS57wjJRSBetOc",
		"VbKA1i59TIdbzmJOSFOq",
		"4HqrLQPyAFBck4IsQaeK",
		"EsgQWFZdyYIDjfFx7LtC",
		"Z3F8OXhtlOtIniQXJPWl"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(pwc.isValid(pw), "The value +'"+pw+"' should be accepted.");
		});
		test.done();
	},
	sentences: function(test){
		var testarray = ["I am so blue I'm greener than purple.",
		"I stepped on a Corn Flake, now I'm a Cereal Killer.",
		"Llamas eat sexy paper clips.",
		"Look, a distraction!",
		"Everyday a grape licks a friendly cow.",
		"Screw world peace, I want a pony!",
		"What do you think about the magical yellow unicorn who dances on the rainbow with a spoonful of blue cheese dressing?",
		"Metallica ate a hairy garilla with purple nipples then swaped a red tyre with a fire breathing goat last Tuesday at breakfast",
		"When life gives you lemons, chuck them at people you hate"];
		test.expect(testarray.length);
		testarray.forEach(function(pw){
			test.ok(pwc.isValid(pw), "The value +'"+pw+"' should be accepted.");
		});
		test.done();
	}
};
