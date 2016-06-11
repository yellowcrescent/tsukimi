/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * tsukimi.js
 * Node.js background service logic for Tsukimi
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var parseArgs = require('minimist');
var os = require('os');
var child_process = require('child_process');
var C = require('chalk');
var settings = require('./settings');
var pkgdata = require('./package');
var db = require('./tsk_db');
var scrapers = require('./scrapers');
var scanner = require('./scanner');
var fsutils = require('./fsutils');
var logthis = require('./logthis');
var EventEmitter = require('events').EventEmitter;

var emitter = new EventEmitter();
var xconf = {
				config_files: [ '~/.config/tsukimi/settings.json', '/etc/tsukimi.conf', './settings.json' ],
			};

// get current commit ref and date
var gitdata = gitInfo();

// wave the banner
process.stdout.write("\n");
process.stdout.write(C.cyan(" ***   ") + C.white("tsukimi") + "\n");
process.stdout.write(C.cyan(" ***   ") + C.cyan("Version "+pkgdata.version+(gitdata.ref ? " [Commit "+gitdata.sref+" - "+gitdata.tstamp+"]" : "")) + "\n");
process.stdout.write(C.cyan(" ***   ") + C.green(pkgdata.copyright)+"\n");
process.stdout.write(C.cyan(" ***   ") + C.green("J. Hipps <jacob@ycnrg.org>")+"\n");
process.stdout.write(C.cyan(" ***   ") + C.yellow("https://tsukimi.io/") + "\n");
process.stdout.write(C.cyan(" ***   ") + C.yellow("https://ycnrg.org/") + "\n\n");

// get framework versions
var initInfo = { version: pkgdata.version, verdata: process.versions, git: gitdata,
				 os: os.platform(), arch: os.arch(), hostname: os.hostname(), path: process.env.PATH };

// Connect to Mongo
emitter.on('config_complete', function() {
	db.connect(settings.mongo);
});

function browserInit(verData, args) {
	// parse args
	tskParseArgs(args);

	// print version info
	logthis.info("starting: tsukimi version %s", pkgdata.version);

	if(gitdata.ref) logthis.info("Git commit ref %s (%s)", gitdata.sref, gitdata.tstamp);
	else logthis.info("Non-Git release");

	logthis.info("NW.js v%s - <http://nwjs.io/>", verData.nw);
	logthis.info("Chromium v%s - <https://www.chromium.org/>", verData.chromium);
	logthis.info("Node.js v%s - <https://nodejs.org/>", process.versions['node']);
	return initInfo;
}

function gitInfo() {
	var xref = (child_process.execSync('git show-ref 2>/dev/null | head -1 | cut -f 1 -d " "').toString().trim() || null);
	var xdts = (child_process.execSync('git show 2>/dev/null | grep ^Date | awk \'{ print $3" "$4" "$6" "$5 }\'').toString().trim() || null);
	var xurl = (xref ? pkgdata.repository.url+'/commits/'+xref : null);
	var sref = (xref ? xref.substr(-8) : null);
	return { ref: xref, sref: sref, tstamp: xdts, url: xurl };
}

function tskParseArgs(args) {
	var opts = parseArgs(args);

	// loglevel
	if(opts.loglevel) {
		if(opts.loglevel.toLowerCase() in logthis.levels) {
			logthis.level = opts.loglevel.toLowerCase();
			logthis.transports['console-logger'].level = logthis.level;
		} else {
			logthis.error("Invalid loglevel specified: %s", C.white(opts.loglevel));
			logthis.error("Valid levels: %s", C.cyan(Object.keys(logthis.levels).join(", ")));
		}
	}

	// xloglevel - Extra loglevel (Mongo and other transports)
	if(opts.xloglevel) {
		if(opts.xloglevel.toLowerCase() in logthis.levels) {
			logthis.transports['mongo-logger'].level = opts.xloglevel.toLowerCase();
		} else {
			logthis.error("Invalid xloglevel specified: %s", C.white(opts.xloglevel));
			logthis.error("Valid levels: %s", C.cyan(Object.keys(logthis.levels).join(", ")));
		}
	}

	// disable mongo logging
	if(opts.nomonlog) {
		logthis.info("MongoDB logging disabled");
	} else {
		// we actually start up with the Mongo transport preconfigured, but disabled (silent = true)
		logthis.transports['mongo-logger'].silent = false;
	}

	// config file
	if(opts.config) {
		xconf.config_files.push(opts.config);
	}

	logthis.debug("raw args: %j", opts, {});
	emitter.emit('config_complete');
}

/**
 * Exports
 **/

exports.browserInit		= browserInit;
exports.db				= db;
exports.scanner			= scanner;
exports.scrapers		= scrapers;
exports.fsutils			= fsutils;
exports.logthis			= logthis;
