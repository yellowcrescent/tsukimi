/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/settings.js
 * Controllers: Settings
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

function settingsController($scope, $location, $routeParams, $http) {
	console.log("settingsController start");

    var template_map = {
        default: {url: 'views/settings/default.html'}
    };

    $scope.settings_page = 'default';
    $scope.view_template = template_map[$scope.settings_page].url;

    hideSplash();
}
