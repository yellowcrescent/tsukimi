/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/splash.js
 * Controllers: Splash
 *
 * Copyright (c) 2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

function splashController($scope, $location, $routeParams, $http) {
	console.log("splashController start");
	window.$scope = $scope;
}

function onConfigLoad(err) {
	// callback for tkcore.browserInit() from tsukimi.js
    // transition to the /home route
	console.log("onConfigLoad");
	window.location.hash = '#!/home';
}
