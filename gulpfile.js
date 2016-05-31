/**
 ******************************************************************************
 **%%vim: set modelines=10:
 *
 * gulpfile.js
 * Gulpfile for task running
 *
 * @author		Jacob Hipps - jacob@ycnrg.org
 * @param 		vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var pkgdata = require('./package');
var gulp = require('gulp');
var compass = require('gulp-compass');
var gutil = require('gulp-util');
var bower = require('gulp-bower');
var C = gutil.colors;
var spawn = require('child_process').spawnSync;
var basedir = process.cwd();

// compass task:
// compile scss files to css
gulp.task('compass', function() {
	gulp.src('sass/*.scss')
		.pipe(compass({
			config_file: 'config.rb',
			css: 'public/css',
			image: 'public/img',
			sass: 'sass'
		}))
});

gulp.task('bower', function() {
	return bower({ cmd: 'install' });
});

// buildmods task:
// build native modules using nw-gyp
var target = pkgdata.nw_version;
var tversion = pkgdata.nw_version;
var natives = pkgdata.native_mods;
var build_bin = 'nw-gyp';

gulp.task('buildmods', function() {
	for(ti in natives) {
		var tmod = natives[ti];
		var wdir = basedir + '/node_modules/' + tmod;
		var build_args = [ 'rebuild', '--target='+target, '--version='+tversion ];
		gutil.log("["+C.cyan(tmod)+"] Building native extension "+C.cyan(tmod)+" ("+C.yellow(wdir)+")");
		gutil.log("["+C.cyan(tmod)+"] "+C.white.underline(build_bin + ' ' + build_args.join(' ')));
		var sout = spawn('nw-gyp', build_args, { cwd: wdir });
		if(sout.error || sout.status) {
			gutil.log(C.red("Failed to build native extension. "+sout.error));
			gutil.log("Program output:");
			console.dir(sout);
			//throw new Error('Execution failed');
			continue;
		}
		gutil.log("["+C.cyan(tmod)+"] Native extension built successfully");
	}
});

// default task
gulp.task('default', [ 'bower', 'compass', 'buildmods' ]);
