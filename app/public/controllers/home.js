/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/home.js
 * Controllers: Home
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var scope_vids = [];

function homeController($scope, $location, $routeParams, $http) {
	console.log("homeController start");

	$scope.group_list = tkconfig.get('groups');

	// set default filter values
	$scope.watchOrder = 'vstat.ctime';
	$scope.watchOrderRev = true;
	$scope.watchLimit = 20;

	$scope.playVideoByPath = function(vpath) {
		tkcore.player.mpv_play(vpath, {}, function(vstatus) {
			console.log(vstatus);
			if(vstatus.msgtype == '_start') {
				logthis.info("mpv: Now playing: %s", vstatus.file);
			} else if(vstatus.msgtype == '_close') {
				logthis.info("mpv: Exited [%s] (%s)", vstatus.file, vstatus.exitcode);
			}
		});
	};

	tkcore.db.query_videos_rr({}, function(err, rez) {
		$scope.recent_adds = rez;
		console.log("query_videos_rr returned:", rez);
		if(!$scope.$$phase) $scope.$apply();
		hideSplash();
	});

	window.$scope = $scope;
}
