/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * core/main.js
 * Node.js background service logic for Tsukimi
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var parseArgs = require('minimist');
var os = require('os');
var fs = require('fs');
var path = require('path');
var child_process = require('child_process');
var mkdirp = require('mkdirp');
var C = require('chalk');
var pkgdata = require('../package');
var db = require('./tsk_db');
var scrapers = require('./scrapers');
var scanner = require('./scanner');
var fsutils = require('./fsutils');
var logthis = require('./logthis');
var EventEmitter = require('events').EventEmitter;

var emitter = new EventEmitter();

// default settings
var settings = {
					"mongo": "mongodb://localhost:27017/tsukimi",
					"data_dir": "%/tsukimi",
					"xbake_path": "/usr/local/bin/xbake",
					"groups": {
						"tv": "TV",
						"anime": "Anime",
						"film": "Film",
						"documentary": "Documentary",
						"cartoon": "Cartoon",
						"music_video": "Music Video"
					}
				};

var xconf = {
				config_files: [ '%/tsukimi/settings.json', '~/.tsukimi/settings.json', '/opt/tsukimi/settings.json', './settings.json' ],
				default_path: '%/tsukimi/settings.json',
				local_path: null,
				status: 'not_ready'
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
function dbConnect(_cbx) {
	db.connect(settings.mongo, function(err) {
		if(!err) {
			xconf.status = 'ready';
			emitter.emit('backend_ready');
		} else {
			xconf.status = 'failed';
			emitter.emit('backend_failed');
		}
		if(_cbx) _cbx(err);
	});
}

function browserInit(verData, args, _cbx) {
	// parse args
	tskParseArgs(args, function(errA) {
		// print version info
		logthis.info("starting: tsukimi version %s", pkgdata.version);

		if(gitdata.ref) logthis.info("Git commit ref %s (%s)", gitdata.sref, gitdata.tstamp);
		else logthis.info("Non-Git release");

		logthis.info("NW.js v%s - <http://nwjs.io/>", verData.nw);
		logthis.info("Chromium v%s - <https://www.chromium.org/>", verData.chromium);
		logthis.info("Node.js v%s - <https://nodejs.org/>", process.versions['node']);

		dbConnect(function(errB) {
			_cbx(errB, initInfo, settings);
		});
	});
}

function gitInfo() {
	var xref = (child_process.execSync('git show-ref 2>/dev/null | head -1 | cut -f 1 -d " "').toString().trim() || null);
	var xdts = (child_process.execSync('git show 2>/dev/null | grep ^Date | awk \'{ print $3" "$4" "$6" "$5 }\'').toString().trim() || null);
	var xurl = (xref ? pkgdata.repository.url+'/commits/'+xref : null);
	var sref = (xref ? xref.substr(-8) : null);
	return { ref: xref, sref: sref, tstamp: xdts, url: xurl };
}

function expandPath(inpath) {
	var confile = inpath;

	if(confile[0] == '~') {
		if(process.platform == 'win32') {
			confile = path.join(process.env.HOMEPATH, confile.slice(1));
		} else {
			confile = path.join(process.env.HOME, confile.slice(1));
		}
	} else if(confile[0] == '%') {
		if(process.platform == 'win32') {
			confile = path.join(process.env.APPDATA, confile.slice(1));
		} else if(process.platform == 'darwin') {
			confile = path.join(process.env.HOME, 'Library', confile.slice(1));
		} else {
			confile = path.join(process.env.HOME, '.config', confile.slice(1));
		}
	}

	return confile;
}

function tskLoadLocalConfig(_cbx) {
	// find first-available config file
	var cpath = null;
	for(icon in xconf.config_files) {
		var confile = expandPath(xconf.config_files[icon]);
		try {
			fs.accessSync(confile);
			cpath = confile;
			break;
		} catch(err) {
			continue;
		}
	}

	// create new config
	if(cpath === null) {
		cpath = expandPath(xconf.default_path);
		xconf.local_path = cpath;
		logthis.warning("No existing local configuration found; creating new local config at default platform-specific path: %s", cpath);
		settings.data_dir = expandPath(settings.data_dir);
		tskSaveLocalConfig(_cbx);
	// parse existing config
	} else {
		xconf.local_path = cpath;
		try {
			fs.readFile(cpath, function(err, data) {
				if(!err) {
					var newset = JSON.parse(data);
					settings = newset;
					logthis.debug("Loaded settings from local config [%s]: ", cpath, newset);
					_cbx(null);
				} else {
					logthis.error("Failed to parse JSON from local config [%s]: ", cpath, err);
					_cbx(err);
				}
			});
		} catch(err) {
			logthis.error("Failed to read local config [%s]: ", cpath, err);
			_cbx(err);
		}
	}
}

function tskSaveLocalConfig(_cbx) {
	var cpath = xconf.local_path;
	var cdata = JSON.stringify(settings, null, '  ');

	try {
		mkdirp(path.dirname(cpath), { mode: 0775 }, function(err) {
			if(!err) {
				fs.writeFile(cpath, cdata, function(err) {
					if(!err) {
						logthis.debug("Wrote new local config OK [%s]: ", cpath, cdata);
						_cbx(null);
					} else {
						logthis.error("Failed to write local config [%s]: ", cpath, err);
						_cbx(err);
					}
				});
			} else {
				logthis.error("Failed to create directory for local config [%s]: ", path.dirname(cpath), err);
				_cbx(err);
			}
		});
	} catch(err) {
		logthis.error("Failed to write local config [%s]: ", cpath, err);
		_cbx(err);
	}
}

function tskParseArgs(args, _cbx) {
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
	/*
	if(opts.nomonlog) {
		logthis.info("MongoDB logging disabled");
	} else {
		// we actually start up with the Mongo transport preconfigured, but disabled (silent = true)
		logthis.transports['mongo-logger'].silent = false;
	}
	*/

	// config file
	if(opts.config) {
		xconf.config_files.push(opts.config);
	}

	logthis.debug("raw args: %j", opts, {});

	tskLoadLocalConfig(function(err) {
		if(!err) {
			logthis.info("Configuration loaded");
			emitter.emit('config_complete');
		} else {
			logthis.error("Failed to load configuration");
			emitter.emit('config_failed');
		}
		if(_cbx) _cbx(err);
	});
}

/**
 * Exports
 **/

exports.browserInit		= browserInit;
exports.tskSaveLocalConfig  = tskSaveLocalConfig;
exports.tskLoadLocalConfig  = tskLoadLocalConfig;
exports.expandPath      = expandPath;
exports.db				= db;
exports.scanner			= scanner;
exports.scrapers		= scrapers;
exports.fsutils			= fsutils;
exports.logthis			= logthis;
exports.settings		= settings;
exports.xconf			= xconf;
