/**
 ******************************************************************************
 **%%vim: set modelines=10:
 *
 * gulpfile.js
 * Gulpfile for task running
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

const pkgdata = require('./package');
const gulp = require('gulp');
const compass = require('gulp-compass');
const gutil = require('gulp-util');
const bower = require('gulp-bower');
const jshint = require('gulp-jshint');
const jshintSummary = require('jshint-stylish-summary');
const del = require('del');
const mkdirp = require('mkdirp');
const NwBuilder = require('nw-builder');
const C = gutil.colors;
const spawn = require('child_process').spawnSync;
const electron = require('electron');
const basedir = process.cwd();

// compass task:
// compile scss files to css
gulp.task('compass', function() {
    gulp.src('sass/*.scss')
        .pipe(compass({
            config_file: 'config.rb',
            css: 'app/public/css',
            image: 'app/public/img',
            sass: 'src/style'
        }));
});

gulp.task('bower', function() {
    return bower({ cmd: 'install' });
});

// buildmods task:
// build native modules using nw-gyp
var target = pkgdata.devDependencies.electron.substr(1);
var tarch = 'x64';
var tdist = 'https://atom.io/download/electron';
var natives = pkgdata.native_mods;
var build_bin = 'node-gyp';

gulp.task('native_mods', function() {
    for(ti in natives) {
        var tmod = natives[ti];
        var wdir = basedir + '/node_modules/' + tmod;
        var build_args = [ 'rebuild', '--target='+target, '--arch='+tarch, '--dist-url='+tdist ];
        gutil.log("["+C.cyan(tmod)+"] Building native extension "+C.cyan(tmod)+" ("+C.yellow(wdir)+")");
        gutil.log("["+C.cyan(tmod)+"] "+C.white.underline(build_bin + ' ' + build_args.join(' ')));
        var sout = spawn(build_bin, build_args, { cwd: wdir });
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

// npm install runner for modules
gulp.task('mods', function() {
    var sout = spawn('npm', [ "install" ], { cwd: basedir });
    if(sout.error || sout.status) {
        gutil.log(C.red("Failed to install node_modules: "+sout.error));
        gutil.log("Program output:");
        console.dir(sout);
    }
    gutil.log("npm install run for nwapp completed");
});

// linting task
var jsource = [ 'app/*.js', 'app/public/*.js', 'app/controllers/*.js' ];
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
    var icoArgs = [ "-c", "-o", "app/tsukimi.ico", "icons/tsukimi_icon.png" ];
    var sout = spawn('icotool', icoArgs);
    if(sout.error || sout.status) {
        gutil.log('icon_ico', C.red("Failed to build Windows ico file: "+sout.error));
        gutil.log('icon_ico', "Program output:");
        console.dir(sout);
    }
    gutil.log('icon_ico', "Windows ico file compiled OK");
});

// cleanup task
gulp.task('clean', function() {
    var cleanlist = [
                        '*.log',
                        'app/css/*.css'
                    ];
    gutil.log('clean', "removing build artifacts:\n\t" + cleanlist.join('\n\t'));
    return del(cleanlist);
});

// strip all non-dist files
gulp.task('distclean', ['clean'], function() {
    var cleanlist = [
                        '.cache',
                        'node_modules',
                        'app/vendor'
                    ];
    gutil.log('clean', "removing build artifacts, modules, cached binaries, and Compass products:\n\t" + cleanlist.join('\n\t'));
    return del(cleanlist);
});

// run application in dev environment
gulp.task('runapp', function() {
    gutil.log(C.white.underline("Spawning Electron application..."));
    var eproc = spawn(electron, [ '.', '--loglevel=debug' ], { cwd: basedir, stdio: 'inherit', stdout: 'inherit', stderr: 'inherit' });
    gutil.log("Execution terminated; return value (%d)", eproc.status);
});

// default task
gulp.task('default', [ 'lint', 'bower', 'compass', 'mods', 'native_mods' ]);
gulp.task('build', [ 'icon_icns', 'icon_ico' ]);
gulp.task('build-dbg', [ 'icon_icns', 'icon_ico' ]);
//gulp.task('buildall', [ 'default', 'build' ]);
//gulp.task('buildall-dbg', [ 'default', 'build-dbg' ]);
gulp.task('run', ['lint', 'compass', 'runapp']);

