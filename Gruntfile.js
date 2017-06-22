module.exports = function(grunt) {

	//	Concatenation file order
	var concatFiles = [
		'src/marble_header.js',
		'node_modules/three/build/three.js',
		'src/three.stereo-effect.js',
		'src/three.deviceorientationcontrols.js',
		'src/three.orbitcontrols.js',
		'node_modules/ulib/src/ulib.pubsub.js',
		'node_modules/ulib/src/ulib.utils.js',
		'node_modules/ulib/src/ulib.url.js',
		'src/screenfull.js',
		'src/pep.js',
		'src/prefix.js',
		'src/detector.js',
		'src/marble.js',
		'src/marble_footer.js'
	];

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		//	Create the dist
		concat: {
			testbuild: {
				options: {
					separator: ';',
					//  We'd prefer to fail on missing files, but at least this will
					//	supposedly warn: https://github.com/gruntjs/grunt-contrib-concat/issues/15
					nonull: true
				},
				files: {
					'test/build/marble-test.js': concatFiles
				}
			},
			distbuild: {
				options: {
					separator: ';'
				},
				files: {
					'dist/version/<%= pkg.name %>-<%= pkg.version %>.js': concatFiles,
					'dist/<%= pkg.name %>-latest.js': concatFiles
				}
			}
		},
		/* TODO: Find a way to test three.js with phantom or some other way */
		qunit: {
			files: ['test/**/*.htm']
		},
		uglify: {
			options: {
				banner: '/*! <%= pkg.name %> <%= pkg.version %> (built <%= grunt.template.today("dd-mm-yyyy") %>) */\n'
			},
			dist: {
				files: {
					'dist/version/<%= pkg.name %>-<%= pkg.version %>.min.js': 'dist/version/<%= pkg.name %>-<%= pkg.version %>.js',
					'dist/<%= pkg.name %>-latest.min.js': 'dist/<%= pkg.name %>-latest.js'
				}
			}
		},
		jshint: {
			files: ['Gruntfile.js', 'src/**/*.js', 'test/**/*.js'],
			options: {
				ignores: ['test/libs/*.js', 'test/build/*.js', 'test/build/**/*.js', 'src/pep.js', 'src/marble_header.js', 'src/marble_footer.js'],
				// options here to override JSHint defaults
				globals: {
					jQuery: true,
					console: true,
					module: true,
					document: true
				},
				//	Ignore specific errors
				'-W015': true,	//	Indentation of }
				'-W099': true,	//	Mixed spaces and tabs
				'-W032': true	//	Unnecessary semicolon
			}
		},
		watch: {
			files: ['<%= jshint.files %>'],
			//	Just build when watching
			tasks: ['concat:testbuild', 'concat:distbuild']
		}
	});

	grunt.loadNpmTasks('grunt-contrib-uglify');
	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-contrib-qunit');
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-concat');

	grunt.registerTask('test', ['jshint', 'qunit']);
	grunt.registerTask('distbuild', ['concat:distbuild']);
	grunt.registerTask('default', ['concat:testbuild', 'jshint', /*'qunit',*/ 'concat:distbuild', 'uglify']);
};
