/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/view_series.js
 * Controllers: View Series
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

function viewSeriesController($scope, $location, $routeParams, $http) {
    console.log("viewSeriesController start");

    $scope.group = $routeParams.group;
    $scope.series_id = $routeParams.series;
    $scope.groupName = tkconfig.groups[$scope.group];
    $scope.group_list = tkconfig.groups;
    $scope.tkconfig = tkconfig;

    // build query string
    //var qparam = {groups: {'$in': [$scope.group]}};
    var qparam = {series_id: $scope.series_id};

    // set default filter values
    $scope.watchOrder = 'vstat.ctime';
    $scope.watchOrderRev = false;
    $scope.watchLimit = null;

    $scope.imgdata = {};

    $scope.showEpisodeInfo = function(ep_id) {
        // show info on a bottom or sidebar area, or overlaid on the poster itself
        var tvideo, tepisode, tfile, vduration;

        try {
            //tepisode = $scope.eplist[ep_id];
            tvideo = $scope.vidlist.filter(function(x) { return x._id == ep_id; })[0];
            tepisode = tvideo._episode;
            tfile = tvideo._files[tvideo.sources[0].id]; // FIXME: detect source correctly
            console.log(`showEpisodeInfo: ${ep_id}`);
        } catch(e) {
            console.log(`showEpisodeInfo: failed to fetch episode '${ep_id}' from eplist`);
            return;
        }

        vduration = moment.duration(tfile.mediainfo.general.duration * 1000);
        for(var taud in tfile.mediainfo.audio) {
            if(tfile.mediainfo.audio[taud].language) {
                tfile.mediainfo.audio[taud].lang_full = iso639.getName(tfile.mediainfo.audio[taud].language);
            }
        }

        // populate the infobox
        $scope.infobox = {
            title: tepisode.title,
            first_aired: moment(tepisode.first_aired * 1000).format("MMMM DD, YYYY"),
            season: tepisode.season,
            episode: tepisode.episode,
            desc: tepisode.synopsis[tepisode.default_synopsis],
            vheight: tfile.mediainfo.video[0].height,
            vaspect: tfile.mediainfo.video[0].display_aspect_ratio,
            vformat: _.upperCase(tfile.mediainfo.video[0].format),
            vprofile: tfile.mediainfo.video[0].format_profile,
            atrack_count: tfile.mediainfo.audio.length,
            atracks: tfile.mediainfo.audio,
            duration: `${vduration.hours() ? vduration.hours() + ':' : ''}${_.padStart(vduration.minutes(),2,'0')}:${_.padStart(vduration.seconds(),2,'0')}`
        };

        // show infobox -- set display:fixed and trigger fade-in transition for opacity
        $('#infobox').show();
        $('#infobox').css('opacity', '1.0');
    };

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

    tkcore.db.query_videos_rr(qparam, function(err0, rez_v) {
        console.log("query_videos_rr returned:", rez_v);
        var tseries = rez_v[0]._series;
        $scope.vidlist = rez_v;

        // get episode list
        tkcore.db.get_episode_data(tseries._id, function(eplist) {

            // get images from database
            tkcore.db.get_series_images(tseries, function(imgs) {
                var tfanart, tposter, season_count;

                tseries['episodes'] = Object.keys(eplist).map(function(x) { return eplist[x]; });
                tseries['_imgdata'] = imgs;

                // get season count; exclude specials (season == 0)
                season_count = _.union(tseries.episodes.map(function(x) { return x.season; })).filter(function(x) { return x; }).length;

                // get fanart
                try {
                    tfanart = tseries._imgdata.filter(function(x) { return x.imgtype == 'fanart'; })[0];
                } catch(e) {
                    tfanart = null;
                    console.log(`Failed to get fanart for ${$scope.series_id}`);
                }

                // get poster
                try {
                    tposter = tseries._imgdata.filter(function(x) { return x.imgtype == 'poster'; })[0];
                } catch(e) {
                    tposter = null;
                    console.log(`Failed to get poster for ${$scope.series_id}`);
                }

                // populate the infobox
                $scope.series_info = {
                    title: tseries.title,
                    year: (new Date(tseries.tv.debut * 1000)).getFullYear(),
                    tv_network: tseries.tv.network,
                    genres: tseries.genre.slice(0, 3).join('/'),
                    se_count: season_count,
                    ep_count: tseries.episodes.length,
                    vid_count: $scope.vidlist.length,
                    desc: tseries.synopsis[Object.keys(tseries.synopsis)[0]],
                    fanart: tfanart,
                    poster: tposter
                };

                if(tfanart) {
                    var bg_image = 'data:' + tfanart.mimetype + ';base64,' + tfanart.img;
                    //$('#bg-fanart').css('background-image', 'url('+bg_image+')');
                    $scope.imgdata.fanart = {'background-image': 'url('+bg_image+')'};
                    console.log(`fanart applied OK: ${tfanart._id}`);
                } else {
                    console.log('fanart NOT applied');
                }

                if(!$scope.$$phase) $scope.$apply();
            });
        });
    });

    window.$scope = $scope;
}
