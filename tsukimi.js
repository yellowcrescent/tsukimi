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

logthis.info("starting: tsukimi version %s", pkgdata.version);
if(gitdata.ref) {
	logthis.info("Git commit ref %s (%s)", gitdata.sref, gitdata.tstamp);
} else {
	logthis.info("Non-Git release");
}

// get framework versions
var initInfo = { version: pkgdata.version, verdata: process.versions, git: gitdata,
				 os: os.platform(), arch: os.arch(), hostname: os.hostname(), path: process.env.PATH };

// Connect to Mongo
db.connect(settings.mongo);

function browserInit(verData) {
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

/**
 * Exports
 **/

exports.browserInit		= browserInit;
exports.db				= db;
exports.scanner			= scanner;
exports.scrapers		= scrapers;
exports.fsutils			= fsutils;
exports.logthis			= logthis;
