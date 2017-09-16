/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * bootstrap.js
 * Startup routines
 *
 * Copyright (c) 2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var core = require("./main");
var logthis = core.logthis;

logthis.debug("tsukimi bootstrap; filtered command line args: %s", nw.App.argv);

nw.Window.open('public/index.html', {new_instance: false, id: 'tsk_main', focus: true}, function(nwin) {
    logthis.debug("New window opened", nwin);
});
