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
 * Import functions from background thread (Node.js)
 **/

var tkcore = require('./tsukimi');
var tkversion = tkcore.browserInit();

/**
 * AngularJS bootstrap and dependency injection
 **/

var tsukimi = angular.module('tsukimi', ['ngRoute', 'ngAnimate', 'mgcrea.ngStrap', 'cgBusy']);


function thispage() {
	return window.location.pathname + window.location.hash;
}

/**
 * Controllers
 **/

function watchHomeController($scope, $location, $routeParams, $http) {
	console.log("browseHomeController start");
}

function libraryController($scope, $location, $routeParams, $http) {
	console.log("libraryController start");
}

function settingsController($scope, $location, $routeParams, $http) {
	console.log("settingsController start");
}

function aboutController($scope, $location, $routeParams, $http) {
	console.log("aboutController start");
	$scope.version = tkversion;
}


/**
 * Routing configuration
 **/

tsukimi.config(
	function($routeProvider, $locationProvider) {
		$routeProvider
			.when('/', {
				templateUrl: 'public/routes/watch_home.html',
				controller: watchHomeController
			})
			.when('/library', {
				templateUrl: 'public/routes/library.html',
				controller: libraryController
			})
			.when('/settings', {
				templateUrl: 'public/routes/settings.html',
				controller: settingsController
			})
			.when('/about', {
				templateUrl: 'public/routes/about.html',
				controller: aboutController
			})
			.otherwise({
				redirectTo: '/'
			});
	});

/**
 * Route change hook
 **/
var path2id = { "": null, "/": "watch", "/library": "library", "/settings": "settings", "/about": "about" };

tsukimi.run(['$rootScope','$location','$routeParams', function($rootScope, $location, $routeParams) {
	$rootScope.$on('$routeChangeSuccess', function(evt, cur, prev) {
		try {
			old_path = prev.$$route.originalPath;
			op_id = path2id[old_path];
			if(op_id) $('#nav-'+op_id).removeClass('active');
		} catch(e) {
			console.log("old_path undefined");
		}
		new_path = cur.$$route.originalPath;
		np_id = path2id[new_path];
		$('#nav-'+np_id).addClass('active');
	});
}]);
