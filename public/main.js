/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * main.js
 * Tsukimi core & AngularJS bootstrapping
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
var logthis = tkcore.logthis;

/**
 * AngularJS bootstrap and dependency injection
 **/

var tsukimi = angular.module('tsukimi', ['ngRoute', 'ngAnimate', 'mgcrea.ngStrap']);

function thispage() {
	return window.location.pathname + window.location.hash;
}

/**
 * Routing configuration
 **/

tsukimi.config(
	function($routeProvider, $locationProvider, $sceProvider) {
		// disable SCE
		$sceProvider.enabled(false);

		$routeProvider
			.when('/', {
				templateUrl: '/public/views/watch_home.html',
				controller: watchHomeController
			})
			.when('/library', {
				templateUrl: '/public/views/library.html',
				controller: libraryController
			})
			.when('/settings', {
				templateUrl: '/public/views/settings.html',
				controller: settingsController
			})
			.when('/about', {
				templateUrl: '/public/views/about.html',
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
			//console.log("old_path undefined");
		}
		new_path = cur.$$route.originalPath;
		np_id = path2id[new_path];
		$('#nav-'+np_id).addClass('active');
	});
}]);

/**
 * Utility functions
 **/

// Allow multiple modals
$(document).on('show.bs.modal', '.modal', function(evt) {
	var zIndex = 1040 + (10 * $('.modal:visible').length);
	$(this).css('z-index', zIndex);
	setTimeout(function() {
		$('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
	}, 0);
});
