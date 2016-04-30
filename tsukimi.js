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

var pkgdata = require("./package");

console.log("tsukimi core starting...");
console.log("tsukimi v"+pkgdata.version+"\n"+pkgdata.author+"\n"+pkgdata.copyright);


function browserInit() {
	console.log("connected to browser context");
	return pkgdata.version;
}

/**
 * Exports
 **/

exports.browserInit		= browserInit;
