/*
 * Sec-Angular-Express 
 *
 * Copyright (c) 2015 Dieter Castel
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
	grunt.initConfig({
	  jshint: {
		all: [
			'GruntFile.js',
			'SAE.js',
			'<%= nodeunit.all %>'
		  ],
		options: {
			jshintrc: '.jshintrc'
		}
	  },
	  nodeunit: {
		all: ['test/*_test.js'],
		options: {
		  reporter: 'junit',
		  reporterOptions: {
			output: 'tmp'
		  }
		}
	  },
	  // Before generating any new files, remove any previously-created files.
	  clean: {
		tests: ['tmp']
	  }
	});

	// These plugins provide necessary tasks.
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-clean');
	grunt.loadNpmTasks('grunt-contrib-nodeunit');

	// Whenever the "test" task is run, first clean the "tmp" dir, then run this
	// plugin's task(s), then test the result.
	grunt.registerTask('test', ['clean', 'nodeunit']);

	// By default, lint and run makecsp as test.
	// Add real tests here in the future
	grunt.registerTask('default', ['clean', 'jshint', 'nodeunit']);
};
