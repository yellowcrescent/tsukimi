/**
 ******************************************************************************
 **`%vim: set modelines=15:
 *
 * db.js
 * Database interfaces
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

const _ = require('lodash');
const {MongoClient} = require('mongodb');

const logger = require('./logthis');
const scanner = require('./scanner');
const utils = require('./utils');
const {Scraper, Scraper_tvdb} = require('./scrapers');


class DBX {

    connect(_cbx) {
        logger.error("Not implemented");
    }

    close() {
        logger.error("Not implemented");
    }

    query_videos(qparams, _cbx) {
        logger.error("Not implemented");
    }

    query_series(qparams, _cbx) {
        logger.error("Not implemented");
    }

    query_episodes(qparams, _cbx) {
        logger.error("Not implemented");
    }

    query_files(qparams, _cbx) {
        logger.error("Not implemented");
    }

    query_images(qparams, _cbx) {
        logger.error("Not implemented");
    }

    get_video(id, _cbx) {
        logger.error("Not implemented");
    }

    get_series(id, _cbx) {
        logger.error("Not implemented");
    }

    get_episode(id, _cbx) {
        logger.error("Not implemented");
    }

    get_file(id, _cbx) {
        logger.error("Not implemented");
    }

    get_image(id, _cbx) {
        logger.error("Not implemented");
    }

    put_video(id, xdata, _cbx) {
        logger.error("Not implemented");
    }

    put_series(id, xdata, _cbx) {
        logger.error("Not implemented");
    }

    put_episode(id, xdata, _cbx) {
        logger.error("Not implemented");
    }

    put_file(id, xdata, _cbx) {
        logger.error("Not implemented");
    }

    put_image(id, xdata, _cbx) {
        logger.error("Not implemented");
    }

    bulk_put_videos(xlist, _cbx) {
        logger.error("Not implemented");
    }

    bulk_put_episodes(xlist, _cbx) {
        logger.error("Not implemented");
    }

    bulk_put_files(xlist, _cbx) {
        logger.error("Not implemented");
    }

    bulk_put_images(xlist, _cbx) {
        logger.error("Not implemented");
    }

    get_series_groups(qparams, _cbx) {
        logger.error("Not implemented");
    }

    query_videos_rr(qparams, _cbx) {
        // use of this function versus query_videos() is preferred for
        // filling out templates, since it resolves external references,
        // then joins them inline with the video document
        var _this = this;
        var qerr = null;
        var qvids = [];
        var qfiles = {};

        var resolveFiles = function(fidlist, fIndex, _cbx) {
            _this.get_file(fidlist[fIndex].id, function(err, tf) {
                if(err) {
                    logger.warning("RefResolver: Failed to lookup file %s:", fidlist[fIndex].id, err);
                } else {
                    qfiles[fidlist[fIndex].id] = tf;
                }

                fIndex++;
                if(fIndex < fidlist.length) {
                    resolveFiles(fidlist, fIndex, _cbx);
                } else {
                    _cbx(qfiles);
                }
            });
        };

        var resolveDocument = function(vids, curIndex, _cbx) {
            var tvid = vids[curIndex];

            // series lookup
            _this.get_series(tvid.series_id, function(err, tser) {
                if(err) logger.error("RefResolver: Series lookup for %s failed:", tvid.series_id, err);

                // episode lookup
                _this.get_episode(tvid.episode_id, function(err, tep) {
                    if(err) logger.error("RefResolver: Episode lookup for %s failed:", tvid.episode_id, err);

                    // episode image lookup
                    _this.get_image({ 'parent.id': tvid.episode_id, 'parent.type': "episode",
                                      '$or': [{ 'metadata.default': true }, { 'metadata.selected': true }] },
                                      function(err, timg) {
                        if(err) logger.error("RefResolver: Image lookup for %s failed:", tvid.episode_id, err);

                        // file lookup
                        qfiles = {};
                        resolveFiles(tvid.sources, 0, function(tfiles) {
                            tvid['_series'] = tser;
                            tvid['_episode'] = tep;
                            tvid['_files'] = tfiles;
                            tvid['_img'] = (timg ? timg: utils.color_bars);
                            qvids.push(tvid);

                            curIndex++;
                            if(curIndex < vids.length) {
                                resolveDocument(vids, curIndex, _cbx);
                            } else {
                                _cbx(qerr, qvids);
                            }
                        });
                    });
                });
            });
        };

        _this.query_videos(qparams, function(err, docs) {
            if(docs.length > 0) {
                resolveDocument(docs, 0, _cbx);
            } else {
                _cbx(err, []);
            }
        });
    }

    query_series_rr(qparams, _cbx) {
        var _this = this;
        var slist = [];

        var resolveSeries = function(dlist, curIndex, _cbx) {
            var tgroup = dlist[curIndex];

            // series lookup
            _this.get_series(tgroup.series_id, function(err, tser) {
                if(err) logger.error("RefResolver: Series lookup for %s failed:", tgroup.series_id, err);

                // episode lookup
                _this.query_episodes({ series_id: tgroup.series_id }, function(err, eplist) {
                    if(err) logger.error("RefResolver: Episode lookup for %s failed:", tgroup.series_id, err);

                    // image lookup
                    _this.get_series_images(tser, function(imgs) {
                        tser['episodes'] = eplist;
                        tser['_groupdata'] = tgroup;
                        tser['_imgdata'] = imgs;
                        slist.push(tser);

                        curIndex++;
                        if(curIndex < dlist.length) {
                            resolveSeries(dlist, curIndex, _cbx);
                        } else {
                            _cbx(null, slist);
                        }
                    });
                });
            });
        };

        _this.get_series_groups(qparams, function(err, docs) {
            if(docs.length > 0) {
                resolveSeries(docs, 0, _cbx);
            } else {
                _cbx(err, []);
            }
        });
    }

    get_series_images(serdata, _cbx, run_count = 0) {
        // retrieves images for the specified series from the database,
        // or downloads them if they are not available locally
        var _this = this;
        var qdata = {
            'parent.id': serdata._id,
            'parent.type': "series",
            '$or': [
                { 'metadata.default': true },
                { 'metadata.selected': true }
            ]
        };

        var scraper = new Scraper();

        _this.query_images(qdata, function(err, docs) {
            if(err) {
                logger.error("Failed to fetch series images", err);
                _cbx([]);
            } else if(docs.length == 0 && run_count == 0) {
                logger.info("Series images not found in database; re-scraping images from source...");
                scraper.fetch_series_images(serdata, function(idata_new) {
                    if(idata_new.length) {
                        _this.put_image_data(idata_new, function(err) {
                            if(err) logger.error("Failed to save image data", err);
                            _cbx(idata_new);
                        });
                    } else {
                        logger.error("Failed to fetch series images; retry failed [a]");
                        _cbx([]);
                    }
                });
            } else if(docs.length == 0 && run_count > 0) {
                logger.error("Failed to fetch series images; retry failed [b]");
                _cbx([]);
            } else {
                logger.verbose("Fetched series images for '%s' (count=%d)", serdata._id, docs.length);
                _cbx(docs);
            }
        });
    }

    get_series_episode_images(eplist, _cbx, run_count = 0) {
        // retrieves episode images for the specified series from the database,
        // or downloads them if they are not available locally
        var _this = this;
        var series_id = eplist[0].series_id;
        var qdata = {
            'parent.setref': series_id,
            'parent.type': "episode",
            '$or': [
                { 'metadata.default': true },
                { 'metadata.selected': true }
            ]
        };

        var scraper = new Scraper();

        _this.query_images(qdata, function(err, docs) {
            if(err) {
                logger.error("Failed to fetch episode images", err);
                _cbx([]);
            } else if(docs.length == 0 && run_count == 0) {
                logger.info("Episode images not found in database; re-scraping images from source...");
                scraper.fetch_episode_images(eplist, function(idata_new) {
                    if(idata_new.length) {
                        _this.put_image_data(idata_new, function(err) {
                            if(err) logger.error("Failed to save image data", err);
                            _cbx(idata_new);
                        });
                    } else {
                        logger.error("Failed to fetch episode images; retry failed [a]");
                        _cbx([]);
                    }
                });
            } else if(docs.length == 0 && run_count > 0) {
                logger.error("Failed to fetch episode images; retry failed [b]");
                _cbx([]);
            } else {
                logger.verbose("Fetched episode images for '%s' (count=%d)", series_id, docs.length);
                _cbx(docs);
            }
        });
    }

    add_series_full(sname, indata, _cbx) {
        var _this = this;
        var sdata = JSON.parse(JSON.stringify(indata));
        delete(sdata.episodes);

        // generate a new norm_id
        var new_tdex = Scraper.normalize(sdata.ctitle);

        // generate series_id
        var tser_id = Scraper.mkid_series(new_tdex, sdata);

        // set series data
        var thisx = {
                        '_id': tser_id,
                        norm_id: new_tdex,
                        title: sdata.ctitle,
                        count: null,
                        genre: sdata.genre,
                        xrefs: sdata.xrefs,
                        tv: sdata.tv,
                        ctitle: sdata.ctitle,
                        synopsis: sdata.synopsis,
                        lastupdated: sdata.lastupdated,
                        artwork: sdata.artwork
                    };

        // process episode data
        var eplist = [];
        for(ti in indata.episodes) {
            //var thisep = episode_schema_update(indata.episodes[ti], tser_id);
            eplist.push(thisep);
        }

        logger.debug("eplist ready for insert", { eplist: eplist });

        // insert series data into database
        _this.put_series(tser_id, thisx, function(err,rec) {
            if(!err) {
                _this.bulk_put_episodes(eplist, function(err,rec) {
                    if(!err) {
                        var xresp = { status: "ok", new_tdex: new_tdex, series_id: tser_id };
                        logger.verbose("Inserted series and episode data into Mongo successfully", xresp);
                        _cbx(xresp);
                    } else {
                        logger.error("Failed to insert episodes into Mongo", { error: err, result: rec });
                        _cbx({ status: "error", error: err });
                    }
                });
            } else {
                logger.error("Failed to insert series into Mongo", { error: err, result: rec });
                _cbx({ status: "error", error: err });
            }
        });
    }

    update_file_series(match, serid, _cbx) {
        var _this = this;

        _this.query_files(match, function(err, files) {
            logger.debug("returned files", { err: err, files: files });

            _this.query_episodes({ series_id: serid }, function(err, eplist) {
                // loop through all of the files and update the series_id and episode_id
                var fcount = eplist.length;
                var newfiles = [];
                for(ti in files) {
                    var tfile = files[ti];
                    tfile.series_id = serid;
                    try {
                        tfile.episode_id = (eplist.filter(function(x) { return parseInt(x.season) == parseInt(tfile.fparse.season) && parseInt(x.episode) == parseInt(tfile.fparse.episode); })[0]._id || null);
                    } catch(e) {
                        logger.warning(e.message);
                        logger.error("Skipping file without episode match", tfile);
                        continue;
                    }
                    newfiles.push(tfile);
                }

                if(newfiles.length > 0) {
                   _this.bulk_put_files(newfiles, function(err, rdoc) {
                        if(!err) logger.verbose("inserted updated file entries OK");
                        else logger.error("Error when adding new file entries", { error: err, result: rdoc});

                        // update series entry with correct count
                        _this.update_series(serid, { count: fcount }, function(err, rdoc) {
                            logger.verbose("updated series file count OK");
                            _cbx(null);
                        });
                    });
                } else {
                    logger.error("No files updated");
                    _cbx('no_matching_files');
                }
            });
        });
    }

    import_selection(selection, iconfig, cbProgress, _cbx) {
        var _this = this;
        var numSelection = selection.length;
        var err = null;
        var scraper = new Scraper();

        var vidImport = function(slist, curIndex, _cbx) {
            // retrieve file object, fresh from the db
            _this.get_file(slist[curIndex]._id, function(err, tfile) {
                // grab series and episode entries
                _this.get_series(tfile.series_id, function(err, tser) {
                    _this.get_episode(tfile.episode_id, function(err, tep) {
                        console.log("tfile =", tfile);
                        console.log("tser =", tser);
                        console.log("tep =", tep);

                        // generate video ID & update progress
                        tvid_id = Scraper.mkid_video(tser, tep);
                        cbProgress(tvid_id);

                        // check if video already exists
                        _this.get_video(tvid_id, function(err, xvdata) {
                            var vdata;
                            var itime = parseInt(Date.now() / 1000);
                            if(xvdata) {
                                logger.debug("Updating existing entry for %s:", tvid_id, xvdata);
                                vdata = xvdata;
                            } else {
                                logger.debug("Creating new entry for %s", tvid_id);
                                vdata = {
                                    _id: tvid_id,
                                    metadata: {
                                        title: null,
                                        series: null,
                                        episode: null,
                                        season: null,
                                        special: tfile.fparse.special || null
                                    },
                                    series_id: tser._id,
                                    episode_id: tep._id,
                                    vstats: {
                                        ctime: itime,
                                        mtime: itime,
                                        last_watched: null,
                                        view_count: 0
                                    },
                                    vscap: [],
                                    sources: [],
                                    groups: [],
                                    tags: [],
                                    status: 'ok'
                                };
                            }

                            // remove default bit from any existing sources; new entry will be set as default
                            // may want to have this be a configuration option
                            for(tvsi in vdata.sources) {
                                vdata.sources[tvsi].default = false;
                            }

                            if(iconfig.group) {
                                vdata.groups.push(iconfig.group);
                            }

                            vdata.vstats.mtime = itime;
                            vdata.sources.push({
                                id: tfile._id,
                                default: true,
                                default_location: tfile.default_location || null,
                                mediainfo: tfile.mediainfo
                            });

                            // fetch episode images
                            _this.fetch_episode_images([tep], function(timglist) {
                                var timg = null;
                                if(timglist.length) {
                                    logger.debug("Fetched episode image OK");
                                    timg = timglist[0];
                                }

                                // upsert episode image into database
                                _this.put_image(timg ? timg._id : null, timg, function(err, rdoc) {
                                    if(err && timg) logger.error("Failed to upsert episode image entry for %s", timg._id, err);

                                    // upsert into videos collection
                                    _this.put_video(tvid_id, vdata, function(err, rdoc) {
                                        if(err) logger.error("Failed to upsert video entry for %s", tvid_id, err);

                                        // update file status
                                        tfile.status = "complete";
                                        _this.put_file(tfile._id, tfile, function(err, rdoc) {
                                            if(err) logger.error("Failed to update file status for %s", tfile._id, err);

                                            // on to the next one
                                            curIndex++;
                                            if(curIndex < numSelection) {
                                                vidImport(slist, curIndex, _cbx);
                                            } else {
                                                _cbx(err);
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            });
        };

        vidImport(selection, 0, _cbx);
    }

    sync_series_image_metadata(serdata, _cbx) {
        var _this = this;

        _this.query_images({ 'parent.id': serdata._id, 'parent.type': 'series' }, function(err, idata) {
            if(err) {
                logger.error("Failed to fetch images for series '%s'", serdata._id, err);
                _cbx(err);
            }

            for(var tdex in idata) {
                try {
                    var tart = serdata.artwork[idata[tdex].imgtype].filter(function(x) { return `${x.source}_${x.id}` == idata[tdex]._id; })[0];
                } catch(e) {
                    logger.debug("sync_series_image_metadata: no matching artwork found for image '%s'", idata[tdex]._id);
                    continue;
                }

                idata[tdex].metadata = tart;
            }

            _this.bulk_put_images(idata, function(err, rdoc) {
                if(err) logger.error("Bulk metadata update for '%s' series images failed", serdata._id, err);
                _cbx(err);
            });
        });
    }
}


class DBX_mongo extends DBX {

    /* Usage: DBX_mongo({url: 'mongodb://HOST:PORT/DATABASE'}) */
    constructor(conf) {
        if(typeof conf == 'undefined') conf = {};
        this.conf = _.defaults({ url: "mongodb://localhost:27017/tsukimi" }, conf);
        this.connected = false;
        this.mongo = null;
    }

    static describe() {
        return {
                name: "mongo",
                description: "MongoDB",
                author: "J. Hipps <jacob@ycnrg.org>",
                url: "https://www.mongodb.com/",
                external_deps: ['mongodb']
               };
    }

    connect(_cbx) {
        var _this = this;

        logger.verbose("Connecting to MongoDB: %s", _this.conf.url);
        try {
            MongoClient.connect(conx, function(err,db) {
                if(!err) {
                    logger.info("Connected to Mongo OK");
                    _this.mongo = db;
                    _this.connected = true;
                    _cbx(null);
                } else {
                    logger.error("Failed to connect to Mongo database:", err);
                    _this.mongo = null;
                    _this.connected = false;
                    _cbx(err);
                }
            });
        } catch(err) {
            logger.error("Failed to connect to Mongo database:", err);
            _cbx(err);
        }
    }

    close() {
        logger.error("Not implemented");
    }

    query_videos(qparams, _cbx) {
        this.mongo.collection('videos').find(qparams).toArray(_cbx);
    }

    query_series(qparams, _cbx) {
        this.mongo.collection('series').find(qparams).toArray(_cbx);
    }

    query_episodes(qparams, _cbx) {
        this.mongo.collection('episodes').find(qparams).toArray(_cbx);
    }

    query_files(qparams, _cbx) {
        this.mongo.collection('files').find(qparams).toArray(_cbx);
    }

    query_images(qparams, _cbx) {
        this.mongo.collection('images').find(qparams).toArray(_cbx);
    }

    get_video(id, _cbx) {
        this.mongo.collection('videos').findOne({ '_id': id }, _cbx);
    }

    get_series(id, _cbx) {
        this.mongo.collection('series').findOne({ '_id': id }, _cbx);
    }

    get_episode(id, _cbx) {
        this.mongo.collection('episode').findOne({ '_id': id }, _cbx);
    }

    get_file(id, _cbx) {
        this.mongo.collection('files').findOne({ '_id': id }, _cbx);
    }

    get_image(id, _cbx) {
        this.mongo.collection('images').findOne({ '_id': id }, _cbx);
    }

    put_video(id, xdata, _cbx) {
        this.mongo.collection('videos').update({ '_id': id}, xdata, {upsert: true}, _cbx);
    }

    put_series(id, xdata, _cbx) {
        this.mongo.collection('series').update({ '_id': id}, xdata, {upsert: true}, _cbx);
    }

    put_episode(id, xdata, _cbx) {
        this.mongo.collection('episodes').update({ '_id': id}, xdata, {upsert: true}, _cbx);
    }

    put_file(id, xdata, _cbx) {
        this.mongo.collection('files').update({ '_id': id}, xdata, {upsert: true}, _cbx);
    }

    put_image(id, xdata, _cbx) {
        this.mongo.collection('images').update({ '_id': id}, xdata, {upsert: true}, _cbx);
    }

    bulk_put_videos(xlist, _cbx) {
        var bulk = this.mongo.collection('videos').initializeUnorderedBulkOp();

        for(var tdex in xlist) {
            bulk.find({ '_id': xlist[tdex]._id }).upsert().replaceOne(xlist[tdex]);
        }

        bulk.execute(_cbx);
    }

    bulk_put_episodes(xlist, _cbx) {
        var bulk = this.mongo.collection('episodes').initializeUnorderedBulkOp();

        for(var tdex in xlist) {
            bulk.find({ '_id': xlist[tdex]._id }).upsert().replaceOne(xlist[tdex]);
        }

        bulk.execute(_cbx);
    }

    bulk_put_files(xlist, _cbx) {
        var bulk = this.mongo.collection('files').initializeUnorderedBulkOp();

        for(var tdex in xlist) {
            bulk.find({ '_id': xlist[tdex]._id }).upsert().replaceOne(xlist[tdex]);
        }

        bulk.execute(_cbx);
    }

    bulk_put_images(xlist, _cbx) {
        var bulk = this.mongo.collection('images').initializeUnorderedBulkOp();

        for(var tdex in xlist) {
            bulk.find({ '_id': xlist[tdex]._id }).upsert().replaceOne(xlist[tdex]);
        }

        bulk.execute(_cbx);
    }

    get_series_groups(qparams, _cbx) {
        // group/reduce by series_id
        var _this = this;
        var reducer = function(curr,result) {
                        if(curr.series_id) result.series_id = curr.series_id;
                        result.count++;
                        result.groups = result.groups.concat(curr.groups);
                      };

        // run aggregation
        _this.mongo.collection('videos').group({ series_id: 1 }, qparams, { count: 0, groups: [] }, reducer, function(err, docs) {
            if(err) logger.error("get_series_groups: Series group aggro failed", qparams, err);

            // consolidate group listings
            for(tgroup in docs) {
                docs[tgroup].groups = _.union(docs[tgroup].groups);
            }

            logger.debug("get_series_groups: returned %d groups", docs.length, { err: err, docs: docs });
            _cbx(err, docs);
        });
    }
}


/** Exports **/

exports.DBX = DBX;
exports.DBX_mongo = DBX_mongo;
