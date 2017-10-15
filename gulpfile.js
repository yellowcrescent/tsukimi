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

const os = require('os');
const pkgdata = require('./package');
const gulp = require('gulp');
const compass = require('gulp-compass');
const gutil = require('gulp-util');
const bower = require('gulp-bower');
const jshint = require('gulp-jshint');
const jshintSummary = require('jshint-stylish-summary');
const del = require('del');
const mkdirp = require('mkdirp');
const C = gutil.colors;
const spawn = require('child_process').spawnSync;
const electron = require('electron');
const builder = require('electron-builder');
const im = require('imagemagick');
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

// linting task
var jsource = [ 'app/*.js', 'app/public/*.js', 'app/public/controllers/*.js' ];
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
gulp.task('icon_icns', ['icons'], function() {
    // output icns file, followed by n-number of power-of-two png icons
    mkdirp.sync('build', {mode: 0755});
    var icnsArgs = [ "build/icon.icns", "build/icons/1024x1024.png" ];
    var sout = spawn('png2icns', icnsArgs);
    if(sout.error || sout.status) {
        gutil.log('icon_icns', C.red("Failed to build Mac icns file: "+sout.error));
        gutil.log('icon_icns', "Program output:");
        console.dir(sout);
    }
    gutil.log('icon_icns', "Mac icns file compiled OK");
});

// build Windows ICO
gulp.task('icon_ico', ['icons'], function() {
    var icoSizes = [1024, 512, 256, 128, 96, 72, 64, 48, 32, 16];

    mkdirp.sync('build', {mode: 0755});

    // build full-size 1024x1024 icon with intermediate sizes
    var srcList = [];
    for(var tii in icoSizes) {
        srcList.push(`build/icons/${icoSizes[tii]}x${icoSizes[tii]}.png`);
    }

    var icoArgs = [ "-c", "-o", "build/icon.ico" ].concat(srcList);
    var sout = spawn('icotool', icoArgs);
    if(sout.error || sout.status) {
        gutil.log('icon_ico', C.red("Failed to build Windows ico file: "+sout.error));
    } else {
        gutil.log('icon_ico', "Windows ico file compiled --> build/icon.ico");
    }

    // build 256x256 icon for NSIS
    var srcList256 = [];
    for(var tii in icoSizes) {
        if(icoSizes[tii] <= 256) srcList256.push(`build/icons/${icoSizes[tii]}x${icoSizes[tii]}.png`);
    }

    icoArgs = [ "-c", "-o", "build/icon256.ico" ].concat(srcList256);
    sout = spawn('icotool', icoArgs);
    if(sout.error || sout.status) {
        gutil.log('icon_ico', C.red("Failed to build Windows ico file: "+sout.error));
    } else {
        gutil.log('icon_ico', "NSIS (256x256) installer ico file compiled --> build/icon256.ico");
    }
});

function resizeImage(srcimg, width, height, dpi, outimg) {
    return new Promise(function(resolve, reject) {
        im.convert([srcimg, '-resize', `${width}x${height}`, outimg], function(err, stdout) {
            if(err) {
                gutil.log('resizeImage', `Failed to resize ${srcimg}: ${err}`);
                reject(err);
            } else {
                gutil.log('resizeImage', `Resized image: ${srcimg} --> ${outimg}`);
                resolve();
            }
        });
    });
}

function gsConvert(srcimg, dpi, outimg) {
    return new Promise(function(resolve, reject) {
        var sout = spawn('gs', ['-q', '-dQUIET', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dNOPROMPT',
                                '-sDEVICE=pngalpha', `-r${dpi}x${dpi}`, `-sOutputFile=${outimg}`, srcimg]);
        if(sout.error || sout.status) {
            gutil.log('gsConvert', `Failed to convert ${srcimg}: ${err}`);
            reject(sout.status);
        } else {
            gutil.log('gsConvert', `Generated raster image: ${srcimg} --> ${outimg}`);
            resolve();
        }
    });
}

gulp.task('icons', function() {
    var icoSrc = 'src/icons/tsukimi_icon.ai';
    var outBase = 'build/icons';
    var imedPath = `${outBase}/raster.png`;
    var icoSizes = [1024, 512, 256, 128, 96, 72, 64, 48, 32, 16];

    mkdirp.sync(outBase, {mode: 0755});

    return gsConvert(icoSrc, 1200, imedPath).then(function() {
        var promises = [];
        for(var tdex in icoSizes) {
            var tsize = icoSizes[tdex];
            promises.push(resizeImage(imedPath, tsize, tsize, 1024, `${outBase}/${tsize}x${tsize}.png`));
        }
        return Promise.all(promises);
    });
});

gulp.task('badges', function() {
        var mogargs = ['-verbose', '-format', 'png', '-path',
                       `${basedir}/app/public/img/badges`, `${basedir}/src/badges/*.ai`];
        gutil.log('badges', C.white("Rendering badges to raster images..."));
        var sout = spawn('mogrify', mogargs);
        if(sout.error || sout.status) {
            gutil.log(C.red("Failed to render badges! "+sout.error));
            gutil.log("Program output:");
            console.dir(sout);
        }
        gutil.log('badges', C.green("Badges rendered successfully!"));
});

// cleanup task
gulp.task('build-dist', ['bower', 'compass', 'icons', 'icon_icns', 'icon_ico'], function() {
    mkdirp.sync('build', {mode: 0755});
    return new Promise(function(resolve, reject) {
        var optList;
        if(os.platform() == 'darwin') {
            optList = ['--mac'];
        } else {
            optList = ['--linux', '--win'];
        }
        var sout = spawn('node_modules/.bin/build', optList, {stdio: ['inherit', 'inherit', 'inherit']});
        if(sout.error || sout.status) {
            gutil.log('build-dist', C.red(`Failed to build release: ${err}`));
            reject(sout.error);
        } else {
            gutil.log('build-dist', C.green(`Built release successfully`));
            resolve();
        }
    });
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
                        'build',
                        'dist',
                        'node_modules',
                        'app/vendor'
                    ];
    gutil.log('distclean', "removing build artifacts, modules, cached binaries, and Compass products:\n\t" + cleanlist.join('\n\t'));
    return del(cleanlist);
});

// run application in dev environment
gulp.task('devapp', function() {
    gutil.log(C.white.underline("Spawning Electron application in dev mode..."));
    var eproc = spawn(electron, [ '.', '--loglevel=debug', '--devtools' ], { cwd: basedir, stdio: 'inherit', stdout: 'inherit', stderr: 'inherit' });
    gutil.log("Execution terminated; return value (%d)", eproc.status);
});

// run app in production-like environment
gulp.task('run', function() {
    gutil.log(C.white.underline("Spawning Electron application..."));
    var eproc = spawn(electron, [ '.' ], { cwd: basedir, stdio: 'inherit', stdout: 'inherit', stderr: 'inherit' });
    gutil.log("Execution terminated; return value (%d)", eproc.status);
});

// default task
gulp.task('default', [ 'lint', 'bower', 'compass', 'native_mods', 'badges' ]);
gulp.task('build', [ 'default', 'icons', 'icon_icns', 'icon_ico', 'build-dist' ]);
gulp.task('build-dbg', [ 'default', 'icons', 'icon_icns', 'icon_ico' ]);
gulp.task('dev', ['lint', 'compass', 'runapp']);
