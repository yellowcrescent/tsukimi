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

var settings = require("./settings");
var pkgdata = require("./package");
var db = require("./tsk_db");

console.log("tsukimi core starting...");
console.log("tsukimi v"+pkgdata.version+"\n"+pkgdata.author+"\n"+pkgdata.copyright);

// Connect to Mongo
db.connect(settings.mongo);


function browserInit() {
	console.log("connected to browser context");
	return pkgdata.version;
}

/**
 * Exports
 **/

exports.browserInit		= browserInit;
exports.db				= db;
