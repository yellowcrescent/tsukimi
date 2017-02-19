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
var jshint = require('gulp-jshint');
var jshintBamboo = require('gulp-jshint-bamboo');
var jshintSummary = require('jshint-stylish-summary');
var del = require('del');
var mkdirp = require('mkdirp');
var NwBuilder = require('nw-builder');
var C = gutil.colors;
var spawn = require('child_process').spawnSync;
var basedir = process.cwd() + '/nwapp';

// compass task:
// compile scss files to css
gulp.task('compass', function() {
	gulp.src('sass/*.scss')
		.pipe(compass({
			config_file: 'config.rb',
			css: 'nwapp/public/css',
			image: 'nwapp/public/img',
			sass: 'sass'
		}));
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

// npm install runner for nwapp
gulp.task('nwmods', function() {
	// output icns file, followed by n-number of power-of-two png icons
	var sout = spawn('npm', [ "install" ], { cwd: basedir });
	if(sout.error || sout.status) {
		gutil.log(C.red("Failed to install node_modules for nwapp: "+sout.error));
		gutil.log("Program output:");
		console.dir(sout);
	}
	gutil.log("npm install run for nwapp completed");
});

// linting task
var jsource = [ 'nwapp/*.js', 'nwapp/public/*.js', 'nwapp/public/controllers/*.js' ];
var jreporter = 'jshint-stylish';

gulp.task('lint', function() {
	return gulp.src(jsource, { base: './' })
			.pipe(jshint('.jshintrc'))
			.pipe(jshint.reporter(jreporter))
			.pipe(jshintSummary.collect())
			.pipe(jshint.reporter('fail'))
			.on('end', jshintSummary.summarize());
});

// build Mac ICNS
gulp.task('icon_icns', function() {
	// output icns file, followed by n-number of power-of-two png icons
	mkdirp.sync('build', {mode: 0755});
	var icnsArgs = [ "build/tsukimi.icns", "icons/tsukimi_icon.png" ];
	var sout = spawn('png2icns', icnsArgs);
	if(sout.error || sout.status) {
		gutil.log('icon_icns', C.red("Failed to build Mac icns file: "+sout.error));
		gutil.log('icon_icns', "Program output:");
		console.dir(sout);
	}
	gutil.log('icon_icns', "Mac icns file compiled OK");
});

// build Windows ICO
gulp.task('icon_ico', function() {
	// output ico file, followed by n-number of power-of-two png icons
	mkdirp.sync('build', {mode: 0755});
	var icoArgs = [ "-c", "-o", "build/tsukimi.ico", "icons/tsukimi_icon.png" ];
	var sout = spawn('icotool', icoArgs);
	if(sout.error || sout.status) {
		gutil.log('icon_ico', C.red("Failed to build Windows ico file: "+sout.error));
		gutil.log('icon_ico', "Program output:");
		console.dir(sout);
	}
	gutil.log('icon_ico', "Windows ico file compiled OK");
});

// nwbuilder task
gulp.task('nwbuilder', function() {
	var nw = new NwBuilder({
		appName: "tsukimi",
		appVersion: pkgdata.version,
		version: pkgdata.nw_version,
		cacheDir: './.cache',
		buildDir: './build',
		buildType: 'versioned',
		flavor: 'normal',
		files: ['./nwapp/**'],
		macIcns: 'build/tsukimi.icns',
		winIco: 'build/tsukimi.ico',
		zip: false,
		macPlist: {mac_bundle_id: 'com.ycnrg.tsukimi'},
		platforms: ['win32', 'win64', 'osx64', 'linux64']
	});

	// Log stuff you want
	nw.on('log', function (msg) {
		gutil.log('nwbuilder', msg);
	});

	// Build returns a promise, return it so the task isn't called in parallel
	return nw.build().catch(function (err) {
		gutil.log('nwbuilder', err);
	});
});

// nwbuilder task
gulp.task('nwbuilder-dbg', function() {
	var nw = new NwBuilder({
		appName: "tsukimi",
		appVersion: pkgdata.version,
		version: pkgdata.nw_version,
		cacheDir: './.cache',
		buildDir: './build-dbg',
		buildType: 'versioned',
		flavor: 'sdk',
		files: ['./nwapp/**'],
		macIcns: 'build/tsukimi.icns',
		winIco: 'build/tsukimi.ico',
		zip: false,
		macPlist: {mac_bundle_id: 'com.ycnrg.tsukimi'},
		platforms: ['win32', 'win64', 'osx64', 'linux64']
	});

	// Log stuff you want
	nw.on('log', function (msg) {
		gutil.log('nwbuilder-dbg', msg);
	});

	// Build returns a promise, return it so the task isn't called in parallel
	return nw.build().catch(function (err) {
		gutil.log('nwbuilder-dbg', err);
	});
});

// cleanup task
gulp.task('clean', function() {
	var cleanlist = [
						'build',
						'build-dbg',
						'*.log',
						'nwapp/*.log'
					];
	gutil.log('clean', "removing build artifacts:\n\t" + cleanlist.join('\n\t'));
	return del(cleanlist);
});

// strip all non-dist files
gulp.task('distclean', function() {
	var cleanlist = [
						'build',
						'build-dbg',
						'.cache',
						'node_modules',
						'nwapp/node_modules',
						'nwapp/public/css/*.css',
						'nwapp/public/vendor'
					];
	gutil.log('clean', "removing build artifacts, modules, cached NW.js binaries, and Compass products:\n\t" + cleanlist.join('\n\t'));
	return del(cleanlist);
});

// default task
gulp.task('default', [ 'lint', 'bower', 'compass', 'nwmods', 'buildmods' ]);
gulp.task('build', [ 'icon_icns', 'icon_ico', 'nwbuilder' ]);
gulp.task('build-dbg', [ 'icon_icns', 'icon_ico', 'nwbuilder-dbg' ]);
gulp.task('buildall', [ 'default', 'build' ]);
gulp.task('buildall-dbg', [ 'default', 'build-dbg' ]);
