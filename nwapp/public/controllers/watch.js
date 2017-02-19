/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/watch.js
 * Controllers: Watch
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

function watchHomeController($scope, $location, $routeParams, $http) {
	console.log("browseHomeController start");

	$scope.group_list = tkconfig.groups;
	$scope.tkconfig = tkconfig;

	// FIXME: get recently-added videos
	tkcore.db.query_videos_rr({}, function(err, rez) {
		$scope.recent_adds = rez;
		console.log("query_videos_rr returned:", rez);
		if(!$scope.$$phase) $scope.$apply();
	});

	window.$scope = $scope;
}

