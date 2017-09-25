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

function viewSeriesController($scope, $location, $routeParams, $http, $filter, $modal, $alert) {
    console.log("viewSeriesController start");

    var template_map = {
        tiled: {url: 'views/view_series/tiled.html'}
    };

    $scope.group = $routeParams.group;
    $scope.series_id = $routeParams.series;
    $scope.groupName = tkconfig.groups[$scope.group];
    $scope.group_list = tkconfig.groups;
    $scope.tkconfig = tkconfig;

    // build query string
    var qparam = {series_id: $scope.series_id};

    // set default filter & view values
    $scope.viewMode = 'tiled';
    $scope.watchOrder = 'vstat.ctime';
    $scope.watchOrderRev = false;
    $scope.watchLimit = null;
    $scope.view_template = template_map[$scope.viewMode].url;

    $scope.imgdata = {};

    $scope.showEpisodeInfo = function(ep_id) {
        // show info on a bottom or sidebar area, or overlaid on the poster itself
        var tvideo, tepisode, tfile, vduration;

        try {
            tvideo = $scope.vidlist.filter(function(x) { return x._id == ep_id; })[0];
            tepisode = tvideo._episode;
            tfile = tvideo._files[tvideo.sources[0].id]; // FIXME: detect source correctly
            //console.log(`showEpisodeInfo: ${ep_id}`);
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

    $scope.showImgSelector = function() {
        logthis.debug2("showImgSelector: series_id = %s", $scope.series_id);

        tkcore.db.get_series_byid($scope.series_id, function(err, sdoc) {
            if(err) {
                logthis.error("Failed to fetch series data for '%s'", $scope.series_id, err);
                return;
            }

            // build property data
            $scope.imgChooser = {imgtype: 'poster', imgtype_list: ['poster', 'fanart', 'banners'], selection: {}, curSelection: null};
            $scope.serdata = sdoc;

            // get current selections
            for(var ttype in $scope.serdata.artwork) {
                var tsel = $scope.serdata.artwork[ttype].filter(function(x) { return x.selected; })[0];
                if(!tsel) tsel = $scope.serdata.artwork[ttype].filter(function(x) { return x.default; })[0];
                $scope.imgChooser.selection[ttype] = (tsel ? `${tsel.source}_${tsel.id}` : null);
            }

            $scope.imgChooser.curSelection = $scope.imgChooser.selection[$scope.imgChooser.imgtype];

            // build modal properties dialog
            $scope.modal = $modal({ title: 'Image Selector', templateUrl: `${pubpath}/views/partials/modal_image_selector.html`, scope: $scope });

            // set up 'save' callback
            $scope.modal.confirm = function() {
                // show progress modal
                $scope.modalWait = $modal({ title: "Saving Selections", templateUrl: `${pubpath}/views/partials/modal_wait.html`, scope: $scope, content: "Updating series information..." });
                $scope.modalWait.contentIcon = "fa-cog fa-spin";

                // save series data, fetch & store new images
                tkcore.db.update_series($scope.series_id, $scope.serdata, function(err) {
                    if(err) logthis.error("Failed to update series data for '%s'", $scope.series_id, err);

                    $scope.modalWait.content = "Fetching images...";
                    _lib_scopeApply($scope);

                    tkcore.scrapers.fetch_series_images($scope.serdata, function(newimgs) {
                        tkcore.db.sync_series_image_metadata($scope.serdata, function(err) {
                            if(err) logthis.error("Failed to sync image metadata for '%s'", $scope.series_id, err);

                            $scope.modalWait.content = "Saving images...";
                            _lib_scopeApply($scope);

                            tkcore.db.put_image_data(newimgs, function(err) {
                                if(err) {
                                    logthis.error("Failed to save image data for '%s'", $scope.series_id, err);
                                } else {
                                    logthis.info("Updated image selections for series '%s' successfully", $scope.series_id);
                                }

                                // close modals, then update the view
                                $scope.modalWait.hide();
                                $scope.modal.finish();
                            });
                        });
                    });
                });
            };

            $scope.modal.finish = function() {
                $scope.modal.hide();
                $scope.refresh();
            };

            // set up image selection change callback
            $scope.modal.inputChange = function() {
                var isplit, itype, isrc, iid;
                itype = $scope.imgChooser.imgtype;
                isplit = $scope.imgChooser.curSelection.match(/^([^_]+)_(.+)$/);
                isrc = isplit[1];
                iid = isplit[2];

                $scope.imgChooser.selection[$scope.imgChooser.imgtype] = $scope.imgChooser.curSelection;
                console.log("modal.inputChange: imgtype=%s, src=%s, id=%s", $scope.imgChooser.imgtype, isrc, iid);

                for(var idex in $scope.serdata.artwork[itype]) {
                    var simg = $scope.serdata.artwork[itype][idex];
                    if($scope.serdata.artwork[itype][idex].id == iid && $scope.serdata.artwork[itype][idex].source == isrc) {
                        $scope.serdata.artwork[itype][idex].selected = true;
                    } else {
                        $scope.serdata.artwork[itype][idex].selected = false;
                    }
                }
            };

            $scope.modal.typeChange = function() {
                console.log("modal.typeChange; imgChooser.imgtype = %s", $scope.imgChooser.imgtype);
                $scope.imgChooser.curSelection = $scope.imgChooser.selection[$scope.imgChooser.imgtype];
                _lib_scopeApply($scope);
            };
        });
    };

    $scope.refresh = function() {
        tkcore.db.query_videos_rr(qparam, function(err0, rez_v) {
            console.log("query_videos_rr returned:", rez_v);
            var tseries = rez_v[0]._series;
            $scope.vidlist = rez_v;

            // get episode list
            tkcore.db.get_episode_data(tseries._id, function(eplist) {

                // get images from database
                tkcore.db.get_series_images(tseries, function(imgs) {
                    var tfanart, tposter, tbanner, season_count, imgurl;

                    tseries['episodes'] = Object.keys(eplist).map(function(x) { return eplist[x]; });
                    tseries['_imgdata'] = imgs;

                    // get season count; exclude specials (season == 0)
                    season_count = _.union(tseries.episodes.map(function(x) { return x.season; })).filter(function(x) { return x; }).length;

                    // get fanart, poster, and banner images
                    tfanart = get_selected_image(tseries._imgdata, 'fanart', tseries._id);
                    tposter = get_selected_image(tseries._imgdata, 'poster', tseries._id);
                    tbanner = get_selected_image(tseries._imgdata, 'banner', tseries._id);

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
                        imgurl = 'data:' + tfanart.mimetype + ';base64,' + tfanart.img;
                        $scope.imgdata.fanart = {'background-image': 'url('+imgurl+')'};
                    }

                    if(tposter) {
                        imgurl = 'data:' + tposter.mimetype + ';base64,' + tposter.img;
                        $scope.imgdata.poster = imgurl;
                    }

                    if(tbanner) {
                        imgurl = 'data:' + tbanner.mimetype + ';base64,' + tbanner.img;
                        $scope.imgdata.banner = imgurl;
                    }

                    if(!$scope.$$phase) $scope.$apply();

                    // back to the top
                    $('.tsk-view').scrollTop();
                });
            });
        });
    };

    $scope.refresh();
    window.$scope = $scope;
}
