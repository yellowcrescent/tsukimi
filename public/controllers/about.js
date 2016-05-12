/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/about.js
 * Controllers: About
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

function aboutController($scope, $location, $routeParams, $http) {
	console.log("aboutController start");
	$scope.version = tkversion;
}
