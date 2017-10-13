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
 * Import functions from core Electron context into the renderer context
 **/

const electron = require('electron');
const {remote, ipcRenderer} = electron;

const _ = require('lodash');
const moment = require('moment');
const iso639 = require('iso-639-1');

const tkcore = remote.require('./index');
const logthis = remote.getGlobal('logger');

//var tkconfig = remote.getGlobal('settings');
var tkconfig = new (remote.require('./core/settings').LocalConfig)();
var tkversion = remote.getGlobal('tkversion');

const basepath = remote.getGlobal('basepath');
const pubpath = basepath + '/app/public';

/**
 * Once scripts are loaded, transition to the /home route and out of the splash cycle
 **/

$(function() {
	// TODO: maybe check `status` value and do something here
	console.log("tkconfig:", tkconfig);
	setGlobalCursor('wait');
	onConfigLoad(null);
});


/**
 * Angular bootstrap and dependency injection
 **/

let tsukimi = angular.module('tsukimi', ['ngRoute', 'ngAnimate', 'mgcrea.ngStrap']);


/**
 * Angular configuration & view router
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
const path2id = { "": null, "/": "splash", "/home": "watch", "/view": "watch", "/library": "library", "/settings": "settings", "/about": "about" };

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

		// enable or disable scroll-fix (prevents the viewport from 'jumping' during /view transitions)
		if(np_id == 'splash' || np_id == 'watch') {
			$('body').addClass('scroll-fix');
		} else {
			$('body').removeClass('scroll-fix');
		}

		// scroll back to top & show splash screen
		window.scrollTo(0, 0);
		showSplash();
	});
}]);

/*
onFinishRender directive
https://stackoverflow.com/questions/15207788/calling-a-function-when-ng-repeat-has-finished
*/
tsukimi.directive('onFinishRender', function($timeout) {
    return {
        restrict: 'A',
        link: function (scope, element, attr) {
            if (scope.$last === true) {
                $timeout(function () {
                    scope.$emit(attr.onFinishRender);
                });
            }
        }
    }
});

/**
 * Utility functions
 **/

function thispage() {
	return window.location.pathname + window.location.hash;
}

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

function showSplash() {
	$('#splash').removeClass('shidden-modal');
	$('#splash').removeClass('shidden');
	setGlobalCursor('wait');
}

function hideSplash() {
	$('#splash').addClass('shidden');
	setGlobalCursor();
	setTimeout(function() {	$('#splash').addClass('shidden-modal'); }, 350);
}

function setGlobalCursor(curname) {
	if(typeof curname == 'undefined') {
		curname = 'auto';
	}
	$('body').css('cursor', curname);
}

function setupPlaycon(title, track, track_tot) {
	$('#playcontrol_pl_title').text(title);
	$('#playcontrol_pl_item').text(track);
	$('#playcontrol_pl_size').text(track_tot);
	$('.tsk-playcon').show();
	$('.tsk-playcon').css('opacity', '1.0');
}

function hidePlaycon() {
	$('.tsk-playcon').css('opacity', '0.0');
	setTimeout(function() { $('.tsk-playcon').hide(); }, 500);
}

// Allow multiple modals
$(document).on('show.bs.modal', '.modal', function(evt) {
	var zIndex = 1040 + (10 * $('.modal:visible').length);
	$(this).css('z-index', zIndex);
	setTimeout(function() {
		$('.modal-backdrop').not('.modal-stack').css('z-index', zIndex - 1).addClass('modal-stack');
	}, 0);
});
