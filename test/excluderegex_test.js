'use strict';
var grunt = require('grunt');
var er = require('../lib/excluderegex');

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
  matching_excludeRoot: function(test) {
	var excludeRoutes = ["notthis", "northis"];
	var excludeRoot = true;
	var testarray = 
		["/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis"];
    test.expect(testarray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	testarray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  nonmatching_excludeRoot: function(test){
	var excludeRoutes = ["notthis", "northis"];
	var excludeRoot = true;
	var testarray = 
		["/",
		"notthis",
		"/notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"notthis/anything",
		"/notthis/anything",
		"/notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
    test.expect(testarray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	testarray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  nonmatching: function(test){
	var excludeRoutes = ["notthis", "northis"];
	var excludeRoot = false;
	var testarray = 
		["notthis",
		"/notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"notthis/anything",
		"/notthis/anything",
		"/notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
    test.expect(testarray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	testarray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  matching: function(test){
	var excludeRoutes = ["notthis", "northis"];
	var excludeRoot = false;
	var testarray = 
		["/",
		"/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis"];
    test.expect(testarray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	testarray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  excludeRoot : function(test){
	var excludeRoutes = ["notthis", "northis"];
	var excludeRoot = true;
	var includeArray = 
		["/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis"];
	var excludeArray = 
		["/",
		"notthis",
		"/notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"notthis/anything",
		"/notthis/anything",
		"/notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  includeRoot : function(test){
	var excludeRoutes = ["notthis", "northis"];
	var excludeRoot = false;
	var includeArray = 
		["/",
		"/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis"];
	var excludeArray = 
		["notthis",
		"/notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"notthis/anything",
		"/notthis/anything",
		"/notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  excludeRootDouble : function(test){
	var excludeRoutes = ["/notthis", "//northis"];
	var excludeRoot = true;
	var includeArray = 
		["/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis"];
	var excludeArray = 
		["/",
		"notthis",
		"/notthis",
		"//notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"notthis/anything",
		"/notthis/anything",
		"//notthis/anything",
		"/notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"//northis/anything",
		"/northis/anything/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  includeRootDouble : function(test){
	var excludeRoutes = ["//notthis", "/northis"];
	var excludeRoot = false;
	var includeArray = 
		["/",
		"/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis"];
	var excludeArray = 
		["notthis",
		"/notthis",
		"//notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"//northis/",
		"notthis/anything",
		"/notthis/anything",
		"//notthis/anything",
		"/notthis/anything/",
		"//notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  excludeRootLong : function(test){
	var excludeRoutes = ["/notthis/extra", "//northis/plus/this"];
	var excludeRoot = true;
	var includeArray = 
		["/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/extra/",
		"/my/extra/long/route/northis/plus/this"];
	var excludeArray = 
		["/",
		"notthis/extra",
		"/notthis/extra",
		"//notthis/extra",
		"/notthis/extra/",
		"northis/plus/this",
		"/northis/plus/this",
		"/northis/plus/this/",
		"notthis/extra/anything",
		"/notthis/extra/anything",
		"//notthis/extra/anything",
		"/notthis/extra/anything/",
		"northis/plus/this/anything",
		"/northis/plus/this/anything",
		"//northis/plus/this/anything",
		"/northis/plus/this/anything/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  includeRootLong : function(test){
	var excludeRoutes = ["//notthis/extra", "/northis/plus/this"];
	var excludeRoot = false;
	var includeArray = 
		["/",
		"/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/extra/",
		"/my/extra/long/route/northis/plus/this"];
	var excludeArray = 
		["notthis/extra",
		"/notthis/extra",
		"//notthis/extra",
		"/notthis/extra/",
		"northis/plus/this",
		"/northis/plus/this",
		"/northis/plus/this/",
		"//northis/plus/this/",
		"notthis/extra/anything",
		"/notthis/extra/anything",
		"//notthis/extra/anything",
		"/notthis/extra/anything/",
		"//notthis/extra/anything/",
		"northis/plus/this/anything",
		"/northis/plus/this/anything",
		"/northis/plus/this/anything/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  noExclusions_excludeRoot: function(test){
	var excludeRoutes = [];
	var excludeRoot = true;
	var includeArray = 
		["/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis",
		"notthis",
		"/notthis",
		"//notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"//northis/",
		"notthis/anything",
		"/notthis/anything",
		"//notthis/anything",
		"/notthis/anything/",
		"//notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
	var excludeArray = 
		["/"];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  noExclusions_includeRoot: function(test){
	var excludeRoutes = [];
	var excludeRoot = false;
	var includeArray = 
		["/",
		"/this",
		"/andthis",
		"/thisisok",
		"/thistoo/too",
		"/my/extra/long/route/notthis/",
		"/my/extra/long/route/northis",
		"notthis",
		"/notthis",
		"//notthis",
		"/notthis/",
		"northis",
		"/northis",
		"/northis/",
		"//northis/",
		"notthis/anything",
		"/notthis/anything",
		"//notthis/anything",
		"/notthis/anything/",
		"//notthis/anything/",
		"northis/anything",
		"/northis/anything",
		"/northis/anything/"];
	var excludeArray = 
		[];
    test.expect(includeArray.length + excludeArray.length);

	var regex = er.getExclusionRegex(excludeRoot, excludeRoutes);

	includeArray.forEach(function(item){
		test.ok(regex.test(item), "Each string should match: \n "+regex+".test("+item+")");
	});

	excludeArray.forEach(function(item){
		//     NOT
		test.ok(!regex.test(item), "None of the strings should EVER match: \n "+regex+".test("+item+")");
	});
	test.done();
  },
  sanitizeRoutes: function(test){
	var testRoutes = 
		["/this",
		"/andthis/",
		"/my/extra/long/route/notthis/",
		"//notthis",
		"//notthis/",
		"//notthis/butthis",
		"notthis/butthis/",
		"northis/anything/"];
	var expectedRoutes =
		["this",
		"andthis/",
		"my/extra/long/route/notthis/",
		"notthis",
		"notthis/",
		"notthis/butthis",
		"notthis/butthis/",
		"northis/anything/"];
	var sanitized = er.sanitizeRoutes(testRoutes);
	test.expect(testRoutes.length);
	sanitized.forEach(function(item, index){
		test.equal(item, expectedRoutes[index], "The item: '"+item+"' should equal '" + expectedRoutes[index]+"'");
	});
	test.done();
  },
  extensiveRoot: function(test){
	var excludeRoutes = ["notthis", "northis"];
	var roots= 
		["/",
		"//"];//,
		// ""];
    test.expect(2*roots.length);
	var regexNoRoot = er.getExclusionRegex(true, excludeRoutes);
	var regexWithRoot = er.getExclusionRegex(false, excludeRoutes);
	roots.forEach(function(item){
		//     NOT
		test.ok(!regexNoRoot.test(item), "No root string should match: \n "+regexNoRoot+".test("+item+")");
		test.ok(regexWithRoot.test(item), "Each root string should match: \n "+regexWithRoot+".test("+item+")");
	});
	test.done();
  }
};
