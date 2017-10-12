/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * scrapers.js
 * Scraper client interface
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

const request = require('request');
const xml2js = require('xml2js');
const _ = require('lodash');

const pkgdata = require("../../package");
var logger = require('./logthis');


class Scraper {

    constructor() {
        this._req = request.defaults({ headers: { 'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)" } });
    }

    /* These methods should be implemented by the subclass */
    search_series() {
        logger.error("Method not implemented");
        return null;
    }

    get_series() {
        logger.error("Method not implemented");
        return null;
    }

    get_episodes() {
        logger.error("Method not implemented");
        return null;
    }

    get_artwork() {
        logger.error("Method not implemented");
        return null;
    }

    /* Common methods */
    fetch_series_images(serdata, _cbx) {
        var artdata = serdata.artwork;
        var imgs = [];
        var ilist = [];

        logger.debug("fetch_series_images: serdata:", serdata);

        var _fetch_images = function(idex, _cxx) {
            var tart = ilist[idex];

            // `encoding: null` *must* be set to prevent request from mangling the response
            // by trying to decode it as UTF-8. instead, it returns `body` as a Buffer() object
            logger.debug("Fetching image '%s'...", tart.url);
            this._req({ url: tart.url, encoding: null }, function(err, resp, body) {
                if(resp.statusCode == 200 && !err) {
                    if(resp.headers['content-type'].match(/^image/i)) {
                        var tobj = {
                            _id: `${tart.source}_${tart.id}`,
                            img: body.toString('base64'),
                            mimetype: resp.headers['content-type'],
                            imgtype: tart._ttype,
                            metadata: tart,
                            lastupdated: parseInt((new Date).getTime() / 1000),
                            parent: {
                                id: tart._series,
                                setref: null,
                                type: 'series'
                            }
                        };

                        delete(tobj.metadata._ttype);
                        delete(tobj.metadata._series);
                        imgs.push(tobj);
                        logger.verbose("Saved image '%s' --> %s", tart.url, tobj._id);
                    } else {
                        logger.warning("Invalid MIME type '%s' for '%s'", resp.headers['content-type'], tart.url);
                    }
                } else {
                    if(err) {
                        logger.error("Failed to fetch %s: request error", tart.url, err);
                    } else {
                        logger.error("Failed to fetch %s: statusCode = %d", tart.url, resp.statusCode, resp, body);
                    }
                }

                idex++;
                if(idex == ilist.length) {
                    _cxx(imgs);
                } else {
                    _fetch_images(idex, _cxx);
                }
            });
        };

        // create list of images to fetch
        for(var ttype in artdata) {
            for(var tdex in artdata[ttype]) {
                var tx = artdata[ttype][tdex];
                if(tx.default || tx.selected) {
                    tx._ttype = ttype;
                    tx._series = serdata._id;
                    ilist.push(tx);
                }
            }
        }

        logger.verbose("Preparing to fetch %d images for %s...", ilist.length, serdata._id);
        _fetch_images(0, _cbx);
    }

    fetch_episode_images() {
        var ilist = [];
        var imgs = [];
        var ilist = [];

        console.log("fetch_episode_images: eplist:", eplist);

        var _fetch_images = function(idex, _cxx) {
            var tart = ilist[idex];

            // `encoding: null` *must* be set to prevent request from mangling the response
            // by trying to decode it as UTF-8. instead, it returns `body` as a Buffer() object
            logger.debug("Fetching image '%s'...", tart.url);
            this._req({ url: tart.url, encoding: null }, function(err, resp, body) {
                if(resp.statusCode == 200 && !err) {
                    if(resp.headers['content-type'].match(/^image/i)) {
                        var tobj = {
                            _id: `${tart.source}_${tart.id}`,
                            img: body.toString('base64'),
                            mimetype: resp.headers['content-type'],
                            imgtype: 'episode',
                            metadata: tart,
                            lastupdated: parseInt((new Date).getTime() / 1000),
                            parent: {
                                id: tart._episode,
                                setref: tart._series,
                                type: 'episode'
                            }
                        };
                        delete(tobj.metadata._episode);
                        delete(tobj.metadata._series);
                        imgs.push(tobj);
                        logger.verbose("Saved image '%s' --> %s", tart.url, tobj._id);
                    } else {
                        logger.warning("Invalid MIME type '%s' for '%s'", resp.headers['content-type'], tart.url);
                    }
                } else {
                    if(err) {
                        logger.error("Failed to fetch %s: request error", tart.url, err);
                    } else {
                        logger.error("Failed to fetch %s: statusCode = %d", tart.url, resp.statusCode, resp, body);
                    }
                }

                idex++;
                if(idex == ilist.length) {
                    _cxx(imgs);
                } else {
                    setTimeout(function() { _fetch_images(idex, _cxx); }, settings.get('scrapers.repdelay') || 500);
                }
            });
        };

        // build list of images from episodes
        for(var tepi in eplist) {
            for(var tdex in eplist[tepi].images) {
                var tart = eplist[tepi].images[tdex];
                if(tart.default || tart.selected) {
                    tart._episode = eplist[tepi]._id;
                    tart._series = eplist[tepi].series_id;
                    ilist.push(tart);
                }
            }
        }

        logger.verbose("Preparing to fetch images for %d episodes...", eplist.length);
        _fetch_images(0, _cbx);
    }

    /* Utility methods */
    static _fix_xml_result(inarr) {
        // xml2js turns single-element tags into arrays... every time
        // what a fucking pain
        var newarr = {};
        for(i in inarr) {
            if(inarr[i].length == 1) {
                newarr[i] = inarr[i][0];
            } else {
                newarr[i] = inarr[i];
            }
        }
        return newarr;
    }
}

class Scraper_tvdb extends Scraper {

    /* Usage: Scraper_tvdb({baseuri: '', apikey: '', banner_path: ''}) */
    constructor(conf) {
        super();
        this.conf = _.defaults({baseuri: 'https://api.thetvdb.com',
                                banner_path: 'http://thetvdb.com/banners',
                                apikey: 'DE1C5FD2150BEE8D'}, conf);
        this.auth_token = null;
        this._request = request.defaults({baseUrl: `http://thetvdb.com/api/${this._conf.apikey}`,
                                          headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});
        this._request2 = request.defaults({baseUrl: this._conf.baseuri,
                                           headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});
    }

    static describe() {
        return {
                name: "tvdb",
                author: "J. Hipps <jacob@ycnrg.org>",
                description: "TheTVDB.com",
                source_url: "https://www.thetvdb.com/",
                logo: "https://ss.ycnrg.org/tvdb.png",
                image_provider: ['poster', 'fanart', 'banner']
               };
    }

    auth(_cbx) {
        if(this.auth_token) {
            // if we already have a token, we're good to go
            _cbx(null);
        } else {
            // otherwise, send the auth request
            this._request2({ uri: '/login', method: 'POST', body: { apikey: this.conf.apikey } }, function(err,resp,body) {
                if(resp.statusCode == 200) {
                    if(body.token) {
                        // we got the token! save it for later
                        this.auth_token = body.token;
                        logger.verbose("Authenticated to thetvdb OK; bearer token: %s", this.auth_token);
                        this._request2 = this._request2.defaults({ headers: { 'Authorization': "Bearer "+this.auth_token } });
                        _cbx(null);
                    } else {
                        logger.error("Unexpected response data", { body: body });
                        _cbx(body.Error);
                    }
                } else {
                    logger.error("Failed to authenticate to thetvdb", { statusCode: resp.statusCode, body: body });
                    _cbx(body.Error);
                }
            });
        }
    }

    search_series(qseries, _cbx) {
        this.tvdb_auth(function(err) {
            if(!err) {
                this._request2({ uri: '/search/series', qs: { name: qseries } }, function(err,resp,body) {
                    if(resp.statusCode == 200) {
                        logger.verbose("got %d results from tvdb", body.data.length, { qseries: qseries, body: body });
                        _cbx({ status: "ok", results: body.data });
                    } else if(resp.statusCode == 404) {
                        logger.warning("tvdb query returned 404 No Results", { qseries: qseries });
                        _cbx({ status: "ok", results: [] });
                    } else if(resp.statusCode == 401) {
                        logger.warning("tvdb returned 401 Unauthorized");
                        _cbx({ status: "error", error: "Unauthorized", results: [] });
                    } else {
                        logger.warning("thetvdb query failed; response code: "+resp.statusCode);
                        _cbx({ status: "error", error: "Server error: "+body.Error, results: [] });
                    }
                });
            } else {
                logger.error("Unable to authenticate to thetvdb: %s", err);
                _cbx({ status: "error", error: "Unable to authenticate to thetvdb: "+err });
            }
        });
    }

    get_series(serid, _cbx) {
        logger.verbose("fetching tvdb data for series ID '%s'", serid);
        this._request({ uri: '/series/'+serid+'/all/en.xml' }, function(err,resp,body) {
            if(resp.statusCode == 200) {
                logger.debug("got series data from tvdb; parsing XML response");
                // decode XML response
                xml2js.parseString(body, function(err,result) {
                    if(!err) {
                        // get data from result
                        logger.debug("raw decoded XML response", { result: result });
                        var xdata = result.Data;
                        this.tvdb_process(xdata, function(outdata) {
                            logger.verbose("Retrieved series, episode, and banner data OK", { serid: serid, outdata: outdata });
                            _cbx({ status: "ok", result: outdata });
                        });
                    } else {
                        logger.warning("failed to parse XML response from tvdb", { error: err });
                        _cbx({ status: "error", error: "Failed to parse XML response" });
                    }
                });
            } else {
                logger.warning("thetvdb query failed", { serid: serid, statusCode: resp.statusCode, body: body });
                _cbx({ status: "error", error: "Server error: "+body });
            }
        });
    }

    get_artwork(serid, adefs, _cbx) {
        var xdout = { banners: [], fanart: [], poster: [], season: [] };
        this._request({ uri: '/series/'+serid+'/banners.xml' }, function(err,resp,body) {
            if(resp.statusCode == 200) {
                logger.debug("got banner data from tvdb; parsing XML response", { serid: serid });
                // decode XML response
                xml2js.parseString(body, function(err,result) {
                    if(!err) {
                        // get data from result
                        logger.debug("raw decoded XML response", { result: result });
                        var blist = result.Banners.Banner;
                        for(bi in blist) {
                            var bb = Scraper._fix_xml_result(blist[bi]);
                            var bantype = bb.BannerType.trim().toLowerCase();
                            var tart =  {
                                            id: bb.id,
                                            source: 'tvdb',
                                            lang: bb.Language,
                                            default: false,
                                            selected: false,
                                            season: (bb.Season || '0'),
                                            url: tvdb_banpath+'/'+bb.BannerPath,
                                            thumb_url: (bb.ThumbnailPath ? tvdb_banpath+'/'+bb.ThumbnailPath : null),
                                            path: bb.BannerPath,
                                            type2: bb.BannerType2
                                        };
                            if(bantype.match(/^(banner|fanart|poster|series|season)$/)) {
                                if(bantype == 'series') bantype = 'banners';
                                if(bantype != 'season') {
                                    if(tart.path == adefs[bantype]) {
                                        tart.default = true;
                                    }
                                }
                                xdout[bantype].push(tart);
                            } else {
                                logger.warning("unknown banner type encountered. bantype: %s", bantype);
                            }
                        }

                        _cbx(xdout);
                    } else {
                        logger.warning("failed to parse XML response from tvdb", { error: err });
                        _cbx(null);
                    }
                });
            } else {
                logger.warning("thetvdb query failed", { serid: serid, statusCode: resp.statusCode, body: body });
                _cbx(null);
            }
        });
    }

    tvdb_process(indata, _cbx) {
        var outdata = {};
        var iser = Scraper._fix_xml_result(indata.Series[0]);

        // get key series data
        var txc = {
                    genre: iser.Genre.split('|').filter(function(x) { return x ? true : false; }),
                    ctitle: iser.SeriesName,
                    lastupdated: (parseInt(iser.lastupdated) || parseInt(Date.now() / 1000.0)),
                    xrefs: {
                            tvdb: iser.id,
                            imdb: iser.IMDB_ID
                           },
                    tv: {
                            network: iser.Network,
                            dayslot: iser.Airs_DayOfWeek,
                            timeslot: iser.Airs_Time,
                            debut: (parseInt(Date.parse(iser.FirstAired) / 1000) || null)
                        },
                    synopsis: {
                                tvdb: iser.Overview
                              },
                    status: (iser.Status || 'unknown'),
                    fetched: parseInt(Date.now() / 1000)
                  };

        // get episodes
        txc.episodes = [];
        for(tei in indata.Episode) {
            txc.episodes[tei] = Scraper._fix_xml_result(indata.Episode[tei]);
        }

        // get banner defaults
        var bandefs = {
                        banners: iser.banner,
                        fanart: iser.fanart,
                        poster: iser.poster
                      };

        // fetch all artwork
        this.get_artwork(txc.xrefs.tvdb, bandefs, function(artlist) {
            // set artwork
            txc.artwork = artlist;
            // and return with completed data struct
            _cbx(txc);
        });
    }

}


/** Exports **/

exports.Scraper = Scraper;
exports.Scraper_tvdb = Scraper_tvdb;
