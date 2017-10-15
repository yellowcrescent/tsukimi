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
/*jshint -W083 */

let vidstatus = {};
let mpv_sock = null;
let mpv_event = null;

const BadgeMap = {
    af: {
        'A_AAC': "tsk_af_aac",
        'A_AC3': "tsk_af_ac3",
        'A_EAC3': "tsk_af_eac3",
        'A_DTS': "tsk_af_dts",
        'A_DTSHD': "tsk_af_dtshd",  /* XXX-PLACEHOLDER: A_DTSHD doesn't exist */
        'A_FLAC': "tsk_af_flac",
        'A_MPEG': "tsk_af_mp3",
        'A_OPUS': "tsk_af_opus",
        'A_VORBIS': "tsk_af_vorbis",
        /* Non-Matroska codecs */
        'Vorbis': "tsk_af_vorbis",
        'WMA': "tsk_af_wma"
    },
    ac: {
        1: "tsk_ac_10mono",
        2: "tsk_ac_20stereo",
        3: "tsk_ac_20stereo",
        4: "tsk_ac_40quad",
        5: "tsk_ac_51chan",
        6: "tsk_ac_51chan",
        7: "tsk_ac_71chan",
        8: "tsk_ac_71chan",
        '5.1': "tsk_ac_51chan",
        '7.1': "tsk_ac_71chan"
    },
    vf: {
        'V_MPEG4/ISO/ASP': "tsk_vf_asp",
        'V_MPEG4/ISO/AVC': "tsk_vf_h264",
        'V_MPEGH/ISO/HEVC': "tsk_vf_h265",
        'V_MPEG2': "tsk_vf_mpeg2",
        'V_THEORA': "tsk_vf_theora",
        'V_VP8': "tsk_vf_vp8",
        'V_VP9': "tsk_vf_vp9",
        'V_MS/VFW/FOURCC / XVID': "tsk_vf_asp",
        'V_MS/VFW/FOURCC / DIVX': "tsk_vf_asp",
        /*'V_PRORES': "tsk_vf_prores",*/
        /*'V_REAL': "tsk_vf_real",*/
        /* Non-Matroska codecs */
        'VC-1': "tsk_vf_vc1",
        'Theora': "tsk_vf_theora",
        'DIVX': "tsk_vf_asp",
        'XVID': "tsk_vf_asp",
        'WMV2': "tsk_vf_wmv",
        'RV': "tsk_vf_real"
    },
    vfp: {
        'High 10@L5.1': "tsk_vfp_hi10p"
    },
    vasp: {
        '1.25': "tsk_vasp_5_4",
        '5:4': "tsk_vasp_5_4",
        '1.33': "tsk_vasp_4_3",
        '4:3': "tsk_vasp_4_3",
        '1.76': "tsk_vasp_16_9",
        '1.77': "tsk_vasp_16_9",
        '1.78': "tsk_vasp_16_9",
        '16:9': "tsk_vasp_16_9",
        '2.33': "tsk_vasp_21_9",
        '21:9': "tsk_vasp_21_9",
        '2.39': "tsk_vasp_239_1"
    },
    res: {
        240: "tsk_res_240",
        244: "tsk_res_240",
        376: "tsk_res_376",
        400: "tsk_res_480", /* DVD anamorphic widescreen, re-scaled with correct AR */
        401: "tsk_res_480", /* DVD anamorphic widescreen, re-scaled with correct AR */
        402: "tsk_res_480", /* DVD anamorphic widescreen, re-scaled with correct AR */
        403: "tsk_res_480", /* DVD anamorphic widescreen, re-scaled with correct AR */
        404: "tsk_res_480", /* DVD anamorphic widescreen, re-scaled with correct AR */
        405: "tsk_res_480", /* DVD anamorphic widescreen, re-scaled with correct AR */
        477: "tsk_res_480",
        478: "tsk_res_480",
        479: "tsk_res_480",
        480: "tsk_res_480",
        574: "tsk_res_576",
        575: "tsk_res_576",
        576: "tsk_res_576",
        716: "tsk_res_hd720",
        717: "tsk_res_hd720",
        718: "tsk_res_hd720",
        719: "tsk_res_hd720",
        720: "tsk_res_hd720",
        1076: "tsk_res_hd1080",
        1077: "tsk_res_hd1080",
        1078: "tsk_res_hd1080",
        1079: "tsk_res_hd1080",
        1080: "tsk_res_hd1080",
        1440: "tsk_res_hd1440",
        1600: "tsk_res_4k1600",
        1716: "tsk_res_4k1716",
        2160: "tsk_res_4k2160"
    },
};

function get_video_badges(vfile) {
    // get video badges
    var _ext = '.png';
    var bads = [];
    try {
        if(vfile.mediainfo.video[0].format_profile in BadgeMap.vfp) {
            bads.push([BadgeMap.vfp[vfile.mediainfo.video[0].format_profile] + _ext]);
        }
        if(vfile.mediainfo.video[0].codec_id in BadgeMap.vf) {
            bads.push([BadgeMap.vf[vfile.mediainfo.video[0].codec_id] + _ext]);
        }
        if(vfile.mediainfo.video[0].height in BadgeMap.res) {
            var prog = '';
            if(vfile.mediainfo.video[0].height < 700) {
                if(vfile.mediainfo.video[0].scan_type.toLowerCase() == 'interlaced') prog = 'i';
                else prog = 'p';
            }
            bads.push([BadgeMap.res[vfile.mediainfo.video[0].height] + prog + _ext]);
        }
        if(vfile.mediainfo.video[0].display_aspect_ratio.substring(0,4) in BadgeMap.vasp) {
            bads.push([BadgeMap.vasp[vfile.mediainfo.video[0].display_aspect_ratio.substring(0,4)] + _ext]);
        }
    } catch(e) {}

    // get audio badges
    try {
        for(var tt in vfile.mediainfo.audio) {
            var trk = vfile.mediainfo.audio[tt];
            if(trk.codec_id in BadgeMap.af) {
                bads.push([BadgeMap.af[trk.codec_id] + _ext, BadgeMap.ac[trk.channels] + _ext]);
            }
        }
    } catch(e) {}

    return bads;
}


function viewSeriesController($scope, $location, $routeParams, $http, $filter, $modal, $alert, $timeout) {
    console.log("viewSeriesController start");

    var template_map = {
        tiled: {url: 'views/view_series/tiled.html'}
    };
    var scraper = new tkcore.scrapers.Scraper();

    $scope._perf_start = Date.now();

    $scope.group = $routeParams.group;
    $scope.series_id = $routeParams.series;
    $scope.groupName = tkconfig.get('groups')[$scope.group];
    $scope.group_list = tkconfig.get('groups');
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
            duration: `${vduration.hours() ? vduration.hours() + ':' : ''}${_.padStart(vduration.minutes(),2,'0')}:${_.padStart(vduration.seconds(),2,'0')}`,
            badges: []
        };

        $scope.infobox.badges = get_video_badges(tfile);

        // show infobox -- set display:fixed and trigger fade-in transition for opacity
        $('#infobox').show();
        $('#infobox').css('opacity', '1.0');
    };

    $scope.fetchEpisodeImages = function() {
        $scope.modalWait = $modal({ title: "Update Episode Images", templateUrl: `${pubpath}/views/partials/modal_wait.html`, scope: $scope, content: "Fetching episode images..." });
        $scope.modalWait.contentIcon = "fa-cog fa-spin";

        // fetch up2date ep data from the database
        tkcore.db.get_episode_data($scope.series_id, function(eplist) {
            scraper.fetch_episode_images(eplist, function(timglist) {
                if(!timglist.length) {
                    logthis.error("Failed to fetch episode images");
                    $scope.modalWait.hide();
                    return;
                }

                // bulk-upsert episode images into database
                tkcore.db.put_image_data(timglist, function(err) {
                    if(err) {
                        logthis.error("Failed to upsert episode image entries for %s", $scope.series_id, err);
                    } else {
                        logthis.verbose("Updated episode images successfully for %s", $scope.series_id);
                    }

                    $scope.refresh();
                    $scope.modalWait.hide();
                });
            });
        });
    };

    $scope.playVideoByPath = function(vpath, _cbx) {
        var nicename;
        try { nicename = vpath.match(/\/([^/]+)$/)[1]; }
        catch(e) { nicename = vpath; }

        // if a video is already playing, queue up the new one via mpv's internal playlist
        if(vidstatus.pl_tot) {
            var rqid = $scope.mpvCommand('playlist-append', vpath);
            logthis.debug("mpv->playlist-append: %s", vpath);
            $scope.valert = $alert({title: "Queued", content: nicename, placement: 'top', type: 'info',
                                    show: true, animation: 'am-fade', duration: 2, icon: 'fa-check',
                                    templateUrl: `${pubpath}/views/partials/alert_oneline.html`,
                                    container: $('#alert-container')});
            mpv_event.emit('event-file-loaded');
            if(_cbx) _cbx();
        } else {
            $scope.valert = $alert({title: "Now Playing", content: nicename, placement: 'top', type: 'info',
                        show: true, animation: 'am-fade', duration: 2, icon: 'fa-play-circle',
                        templateUrl: `${pubpath}/views/partials/alert_oneline.html`,
                        container: $('#alert-container')});
            tkcore.player.mpv_play(vpath, {}, function(vstatus) {
                if(vstatus.msgtype == '_start') {
                    logthis.info("mpv: Now playing: %s", vstatus.file);
                } else if(vstatus.msgtype == '_ipc_control') {
                    if(vstatus.status == 'connect') {
                        mpv_sock = vstatus.sock;
                        mpv_event = vstatus.event;
                        if(_cbx) _cbx();
                    }
                } else if(vstatus.msgtype == '_ipc_vidstatus') {
                    // update vidstatus
                    vidstatus = _jsonCopy(vstatus.data);
                    logthis.debug("** vidstatus = %j", vidstatus);
                    if(vidstatus.filename) {
                        setupPlaycon(vidstatus.filename.match(/\/([^/]+)$/)[1], vidstatus.pl_item + 1, vidstatus.pl_tot);
                    }
                } else if(vstatus.msgtype == '_close') {
                    logthis.info("mpv: Exited [%s] (%s)", vstatus.file, vstatus.exitcode);
                    mpv_sock = null;
                    mpv_event = null;
                    vidstatus = {};
                    hidePlaycon();
                }
            });
        }
    };

    $scope.mpvCommand = function(cmd, args) {
        var rqid = null;
        logthis.debug("mpvCommand: %s %s", cmd, args ? args : '');

        if(!mpv_sock) {
            logthis.warning("Attempted to send mpv command, but IPC connection not established");
            return false;
        }

        if(cmd == 'stop') {
            rqid = mpv_sock('stop', []);
        } else if(cmd == 'playOrPause') {
            rqid = mpv_sock('set_property', ['pause', !vidstatus.paused]);
        } else if(cmd == 'playlist-next') {
            rqid = mpv_sock('playlist-next', []);
        } else if(cmd == 'playlist-prev') {
            rqid = mpv_sock('playlist-prev', []);
        } else if(cmd == 'chapter-next') {
            rqid = mpv_sock('set_property', ['chapter', ++vidstatus.chapter]);
        } else if(cmd == 'chapter-prev') {
            if(vidstatus.chapter > 0) {
                rqid = mpv_sock('set_property', ['chapter', --vidstatus.chapter]);
            }
        } else if(cmd == 'playlist-append') {
            rqid = mpv_sock('loadfile', [args, 'append']);
        }

        logthis.debug("mpvCommand: request_id => #%s", rqid);
        return rqid;
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
                setGlobalCursor('wait');
                $scope.modalWait = $modal({ title: "Saving Selections", templateUrl: `${pubpath}/views/partials/modal_wait.html`, scope: $scope, content: "Updating series information..." });
                $scope.modalWait.contentIcon = "fa-cog fa-spin";

                // save series data, fetch & store new images
                tkcore.db.update_series($scope.series_id, $scope.serdata, function(err) {
                    if(err) logthis.error("Failed to update series data for '%s'", $scope.series_id, err);

                    $scope.modalWait.content = "Fetching images...";
                    _lib_scopeApply($scope);

                    scraper.fetch_series_images($scope.serdata, function(newimgs) {
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
                                setGlobalCursor();
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

    $scope.playSelection = function() {
        var epid = $('.imglist__.selected')[0].id.split('imglist__')[1];
        var tvid = $scope.vidlist.filter(function(x) { return x._id == epid; })[0];
        $scope.playVideoByPath(tvid._files[tvid.sources[0].id].location[tvid._files[tvid.sources[0].id].default_location].fpath.real);
        $('.imglist__.selected').removeClass('selected');
    };

    $scope.playFromSelection = function() {
        var start_id = $('.imglist__.selected')[0].id.split('imglist__')[1];
        var xsel = $('.imglist__.selected').parent().parent().parent().children();
        var pfiles = [];
        var istart = false;
        for(var tii in xsel) {
            var tep = xsel[tii];
            if(!tep.id) continue;
            if(istart || tep.id == `ep__${start_id}`) {
                istart = true;
                var epid = tep.id.split('ep__')[1];
                var tvid = $scope.vidlist.filter(function(x) { return x._id == epid; })[0]; /* jshint: ignore */
                pfiles.push(tvid._files[tvid.sources[0].id].location[tvid._files[tvid.sources[0].id].default_location].fpath.real);
            }
        }

        $('.imglist__.selected').removeClass('selected');

        $scope.playVideoByPath(pfiles[0], function() {
            var nfiles = pfiles.slice(1);
            for(var nfi in nfiles) {
                var vpath = nfiles[nfi];
                $scope.mpvCommand('playlist-append', vpath);
                logthis.debug("mpv->playlist-append: %s", vpath);
            }

            if(nfiles.length) {
                $scope.valert = $alert({title: "Queued", content: `${nfiles.length} more episodes`, placement: 'top', type: 'info',
                                        show: true, animation: 'am-fade', duration: 2, icon: 'fa-check',
                                        templateUrl: `${pubpath}/views/partials/alert_oneline.html`,
                                        container: $('#alert-container')});
                mpv_event.emit('event-file-loaded');
            }
        });
    };

    $scope.contextMenu = function(evt) {
        var iid;

        console.log(evt);
        try {
            iid = evt.target.id.split('imglist__')[1];
        } catch(e) {
            iid = null;
        }

        if(iid) {
            evt.target.classList.add('selected');

            // create context menu
            var fmenu = [
                {
                    label: 'Play/Enqueue',
                    accelerator: 'Enter',
                    click: $scope.playSelection
                },
                {
                    label: 'Play from here',
                    accelerator: 'Shift+Enter',
                    click: $scope.playFromSelection
                },
                {
                    type: 'separator'
                },
                {
                    label: 'Properties...',
                }
            ];
            tkcore.createPopupMenu(fmenu, evt.x, evt.y);
        }

        evt.preventDefault();
        return false;
    };

    $scope.refresh = function() {
        showSplash();
        tkcore.db.query_videos_rr(qparam, function(err0, rez_v) {
            logthis.debug2("query_videos_rr returned:", rez_v);
            logthis.debug("** _perf_time(@query_videos_rr) = %d ms", Date.now() - $scope._perf_start);
            var tseries = rez_v[0]._series;
            $scope.vidlist = rez_v;

            // get episode list
            tkcore.db.get_episode_data(tseries._id, function(eplist) {
                logthis.debug("** _perf_time(@get_episode_data) = %d ms", Date.now() - $scope._perf_start);

                // get images from database
                tkcore.db.get_series_images(tseries, function(imgs) {
                    var tfanart, tposter, tbanner, season_count, imgurl;
                    logthis.debug("** _perf_time(@get_series_images) = %d ms", Date.now() - $scope._perf_start);

                    tseries['episodes'] = Object.keys(eplist).map(function(x) { return eplist[x]; });
                    tseries['_imgdata'] = imgs;

                    // get season count; exclude specials (season == 0)
                    season_count = _.union(tseries.episodes.map(function(x) { return x.season; })).filter(function(x) { return x; }).length;

                    // get fanart, poster, and banner images
                    tfanart = get_selected_image(tseries._imgdata, 'fanart', tseries._id);
                    tposter = get_selected_image(tseries._imgdata, 'poster', tseries._id);
                    tbanner = get_selected_image(tseries._imgdata, 'banner', tseries._id);
                    logthis.debug("** _perf_time(@get_selected_image) = %d ms", Date.now() - $scope._perf_start);

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
                    logthis.debug("** _perf_time(@refresh) = %d ms", Date.now() - $scope._perf_start);
                });
            });
        });
    };

    $scope.$on('group-render-complete', function(evt) {
        for(var iiep in $scope.vidlist) {
            var tep = $scope.vidlist[iiep];
            document.getElementById('imglist__' + tep._id).src = "data:" + tep._img.mimetype + ";base64," + tep._img.img;
        }

        // set up event listeners
        document.getElementById('episode-list').addEventListener('contextmenu', $scope.contextMenu);

        hideSplash();

        $scope._perf_stop = Date.now();
        $scope._perf_time = $scope._perf_stop - $scope._perf_start;
        logthis.debug("** _perf_time = %d ms", $scope._perf_time);
    });

    $scope.refresh();
    window.$scope = $scope;
}
