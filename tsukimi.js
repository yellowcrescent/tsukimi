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
var settings = require("./settings");
var pkgdata = require("./package");
var db = require("./tsk_db");
var scrapers = require("./scrapers");
var scanner = require('./scanner');
var logthis = require('./logthis');

// banner
process.stdout.write("tsukimi v"+pkgdata.version+"\n"+pkgdata.author+"\n"+pkgdata.copyright+"\nhttps://tsukimi.io/\nhttps://ycnrg.org\n\n");
logthis.info("starting: tsukimi version %s", pkgdata.version);

// get current commit ref and date
var gitdata = gitInfo();
if(gitdata.ref) {
	logthis.info("Git commit ref %s (%s)", gitdata.sref, gitdata.tstamp);
} else {
	logthis.info("Non-Git release");
}

// Connect to Mongo
db.connect(settings.mongo);


function browserInit() {
	var initInfo = { version: pkgdata.version, os: os.platform(), arch: os.arch(), hostname: os.hostname(), path: process.env.PATH, git: gitdata };
	logthis.verbose("Connected to Node.js context from Browser context OK", initInfo);
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
exports.logthis			= logthis;
