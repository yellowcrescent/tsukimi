/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * tsukimi_browser.js
 * AngularJS controllers and services for browser logic
 *
 * Copyright (c) 2014-2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

/**
 * AngularJS bootstrap and dependency injection
 **/

var tsukimi = angular.module('tsukimi', ['ngRoute', 'ngAnimate', 'mgcrea.ngStrap', 'cgBusy']);

/**
 * Controllers
 **/

function homeController($scope, $location, $routeParams, $http) {
	console.log("homeController start");
}


/**
 * Routing configuration
 **/

tsukimi.config(
	function($routeProvider, $locationProvider) {
		$routeProvider
			.when('/', {
				templateUrl: 'public/routes/home.html',
				controller: homeController
			})
			.otherwise({
				redirectTo: '/'
			});
	});
