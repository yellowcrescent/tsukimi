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

const electron = require('electron');
const {remote, ipcRenderer} = electron;

const _ = require('lodash');
const moment = require('moment');
const iso639 = require('iso-639-1');

const tkcore = remote.require('./index');
const logthis = remote.getGlobal('logger');

var tkconfig = remote.getGlobal('settings');
var tkversion = process.versions;

const basepath = remote.getGlobal('basepath');
const pubpath = basepath + '/app/public';

// Once scripts are loaded, move out of the splash cycle
$(function() {
	// TODO: maybe check `status` value and do something here
	console.log("tkconfig:", tkconfig);
	onConfigLoad(null);
});


/**
 * AngularJS bootstrap and dependency injection
 **/

var tsukimi = angular.module('tsukimi', ['ngRoute', 'ngAnimate', 'mgcrea.ngStrap']);

function thispage() {
	return window.location.pathname + window.location.hash;
}

/**
 * Angular configuration
 **/

tsukimi.config(
	function($routeProvider, $locationProvider, $sceProvider, $compileProvider) {
		// disable SCE
		$sceProvider.enabled(false);

		// whitelist chrome-extension scheme to work-around angular's overprotective CSRF bullshit
		$compileProvider.imgSrcSanitizationWhitelist(/^\s*((https?|ftp|file|blob|chrome-extension):|data:image\/)/);
		$compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|tel|file|chrome-extension):/);

		// configure routes
		$routeProvider
			.when('/', {
				templateUrl: 'views/splash.html',
				controller: splashController
			})
			.when('/home', {
				templateUrl: 'views/home.html',
				controller: homeController
			})
			.when('/view/:group', {
				templateUrl: 'views/view_group/index.html',
				controller: viewGroupController
			})
			.when('/view/:group/:series', {
				templateUrl: 'views/view_series/index.html',
				controller: viewSeriesController
			})
			.when('/view/:group/:series/:episode', {
				templateUrl: 'views/view_episode.html',
				controller: viewEpisodeController
			})
			.when('/library', {
				templateUrl: 'views/library.html',
				controller: libraryController
			})
			.when('/settings', {
				templateUrl: 'views/settings.html',
				controller: settingsController
			})
			.when('/about', {
				templateUrl: 'views/about.html',
				controller: aboutController
			})
			.otherwise({
				redirectTo: '/'
			});
	});

/**
 * Route change hook
 **/
var path2id = { "": null, "/": "splash", "/home": "watch", "/view": "watch", "/library": "library", "/settings": "settings", "/about": "about" };

tsukimi.run(['$rootScope','$location','$routeParams', function($rootScope, $location, $routeParams) {
	$rootScope.$on('$routeChangeSuccess', function(evt, cur, prev) {
		try {
			old_path = '/' + prev.$$route.originalPath.split('/')[1];
			op_id = path2id[old_path];
			if(op_id) $('#nav-'+op_id).removeClass('active');
		} catch(e) {
			//console.log("old_path undefined");
		}
		new_path = '/' + cur.$$route.originalPath.split('/')[1];
		np_id = path2id[new_path];
		$('#nav-'+np_id).addClass('active');
	});
}]);

/**
 * Utility functions
 **/

function _copy(obj) {
	return $.extend({}, obj);
}

function _deepCopy(obj) {
	return $.extend(true, {}, obj);
}

function _jsonCopy(obj) {
	return JSON.parse(JSON.stringify(obj));
}

function getGlobalCssVar(cvar) {
	return $(':root')[0].style.getPropertyValue(cvar);
}

function setGlobalCssVar(cvar, cval) {
	return $(':root')[0].style.setProperty(cvar, cval);
}

function get_selected_image(imglist, imgtype, xid) {
    var timg, tdef, tsel;

    try {
        tsel = imglist.filter(function(x) { return x.imgtype == imgtype && x.metadata.selected; });
        tdef = imglist.filter(function(x) { return x.imgtype == imgtype && x.metadata.default; });
        if(tsel.length) {
            timg = tsel[0];
        } else if(tdef.length) {
            timg = tdef[0];
        } else {
            logthis.warning(`No ${imgtype} images matched for ${xid}`);
            timg = tkcore.utils.color_bars;
        }
    } catch(e) {
        timg = tkcore.utils.color_bars;
        logthis.error(`Failed to get ${imgtype} for ${xid}`);
    }

    return timg;
}

// Allow multiple modals
$(document).on('show.bs.modal', '.modal', function(evt) {
	var zIndex = 1040 + (10 * $('.modal:visible').length);
	$(this).css('z-index', zIndex);
	setTimeout(function() {
		$('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
	}, 0);
});
