/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * scrapers.js
 * Scraper client interface
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
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
        var _this = this;
        var artdata = serdata.artwork;
        var imgs = [];
        var ilist = [];

        logger.debug2("fetch_series_images: serdata:", serdata);

        var _fetch_images = function(idex, _cxx) {
            var tart = ilist[idex];

            // `encoding: null` *must* be set to prevent request from mangling the response
            // by trying to decode it as UTF-8. instead, it returns `body` as a Buffer() object
            logger.debug("Fetching image '%s'...", tart.url);
            _this._req({ url: tart.url, encoding: null }, function(err, resp, body) {
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
                        logger.debug("Saved image '%s' --> %s", tart.url, tobj._id);
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

        logger.debug("Preparing to fetch %d images for %s...", ilist.length, serdata._id);
        _fetch_images(0, _cbx);
    }

    fetch_episode_images(eplist, _cbx) {
        var _this = this;
        var ilist = [];
        var imgs = [];
        var ilist = [];

        logger.debug2("fetch_episode_images: eplist:", eplist);

        var _fetch_images = function(idex, _cxx) {
            var tart = ilist[idex];

            // `encoding: null` *must* be set to prevent request from mangling the response
            // by trying to decode it as UTF-8. instead, it returns `body` as a Buffer() object
            logger.debug("Fetching image '%s'...", tart.url);
            _this._req({ url: tart.url, encoding: null }, function(err, resp, body) {
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
                        logger.debug("Saved image '%s' --> %s", tart.url, tobj._id);
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
                    setTimeout(function() { _fetch_images(idex, _cxx); },
                               settings.get('scrapers.global.repdelay') || 500);
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

        logger.debug("Preparing to fetch images for %d episodes...", eplist.length);
        _fetch_images(0, _cbx);
    }

    /* Utility methods */
    static mkid_series(sid, xdata) {
        // create unique series ID with tdex_id + release year
        // if @sid (tdex_id) is not passed in, the corrected title
        // will be used instead
        var dyear;

        if(!sid) {
            sid = Scraper.normalize(xdata.ctitle);
        }

        if(xdata.tv.debut) {
            dyear = String((new Date(parseFloat(xdata.tv.debut) * 1000.0)).getFullYear());
        } else {
            dyear = "90" + String(parseInt(Date.now() / 1000)).substr(-5);
        }

        return sid + "." + dyear;
    }

    static mkid_episode(sid, xdata) {
        var isuf = (xdata.id || String(Date.now() / 1000000.0).split('.')[1]);
        var xepi = xdata.episode !== null ? String(xdata.episode) : String(xdata.episode_special);
        return sid + "." + (String(xdata.season) || '0') + "." + (xepi || '0') + "." + isuf;
    }

    static mkid_video(serdata, epidata) {
        var isuf = (epidata.first_aired || String(Date.now() / 1000000.0).split('.')[1]);
        return serdata._id + "." + (String(epidata.season) || '0') + "." + (String(epidata.episode) || '0') + "." + isuf;
    }

    static normalize(instr) {
        return instr.replace(/[ ★☆\.]/g,'_').replace(/['`\-\?!%&\*@\(\)#:,\/\\;\+=\[\]\{\}\$\<\>]/g,'').toLowerCase().trim();
    }

    static _fix_xml_result(inarr) {
        // xml2js turns single-element tags into arrays... every time
        // what a fucking pain
        var newarr = {};

        for(var i in inarr) {
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
        if(typeof conf == 'undefined') conf = settings.get('scrapers.tvdb');
        this._conf = _.defaults({baseuri: 'https://api.thetvdb.com',
                                banner_path: 'http://thetvdb.com/banners',
                                apikey: 'DE1C5FD2150BEE8D'}, conf);
        this.auth_token = null;
        this._request = request.defaults({baseUrl: `http://thetvdb.com/api/${this._conf.apikey}`,
                                          headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});
        this._request2 = request.defaults({baseUrl: this._conf.baseuri, json: true,
                                           headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});
    }

    static describe() {
        return {
                name: "tvdb",
                author: "J. Hipps <jacob@ycnrg.org>",
                description: "TheTVDB.com",
                source_url: "https://www.thetvdb.com/",
                logo: "https://ss.ycnrg.org/tvdb.png",
                image_provider: ['poster', 'fanart', 'banner', 'season', 'episode']
               };
    }

    auth(_cbx) {
        var _this = this;

        if(this.auth_token) {
            // if we already have a token, we're good to go
            _cbx(null);
        } else {
            // otherwise, send the auth request
            this._request2({ uri: '/login', method: 'POST', body: { apikey: this._conf.apikey } }, function(err,resp,body) {
                if(err) {
                    logger.error("Failed to authenticate to thetvdb. Request Failed: ", err);
                    _cbx(err);
                } else if(resp.statusCode == 200) {
                    if(body.token) {
                        // we got the token! save it for later
                        _this.auth_token = body.token;
                        logger.verbose("Authenticated to thetvdb OK; bearer token: %s", _this.auth_token);
                        _this._request2 = _this._request2.defaults({ headers: { 'Authorization': `Bearer ${_this.auth_token}` } });
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
        var _this = this;

        this.auth(function(err) {
            if(!err) {
                _this._request2({ uri: '/search/series', qs: { name: qseries }}, function(err,resp,body) {
                    if(resp.statusCode == 200) {
                        logger.debug2("got %d results from tvdb", body.data.length, { qseries: qseries, body: body });
                        _cbx({ status: "ok", results: body.data });
                    } else if(resp.statusCode == 404) {
                        logger.debug("tvdb query returned 404 No Results", { qseries: qseries });
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
        var _this = this;
        logger.debug("fetching tvdb data for series ID '%s'", serid);

        this._request({ uri: '/series/'+serid+'/all/en.xml' }, function(err,resp,body) {
            if(resp.statusCode == 200) {
                logger.debug("got series data from tvdb; parsing XML response");
                // decode XML response
                xml2js.parseString(body, function(err,result) {
                    if(!err) {
                        // get data from result
                        logger.debug2("raw decoded XML response", { result: result });
                        var xdata = result.Data;
                        _this.tvdb_process(xdata, function(outdata) {
                            logger.debug("Retrieved series, episode, and banner data OK", { serid: serid, outdata: outdata });
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
        var _this = this;
        var xdout = { banners: [], fanart: [], poster: [], season: [] };

        this._request({ uri: '/series/'+serid+'/banners.xml' }, function(err,resp,body) {
            if(resp.statusCode == 200) {
                logger.debug("got banner data from tvdb; parsing XML response", { serid: serid });
                // decode XML response
                xml2js.parseString(body, function(err,result) {
                    if(!err) {
                        // get data from result
                        logger.debug2("raw decoded XML response", { result: result });
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

        // set series ID
        txc._id = Scraper.mkid_series(null, txc);

        // get episodes
        txc.episodes = [];
        for(tei in indata.Episode) {
            txc.episodes[tei] = tvdb_episode_schema_update(Scraper._fix_xml_result(indata.Episode[tei]), txc._id);
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

    tvdb_episode_schema_update(epdata, serid) {
        var newep = {
            _id: null,
            series_id: serid,
            season: parseInt(epdata.SeasonNumber) || null,
            episode: parseInt(epdata.EpisodeNumber) || null,
            episode_absolute: parseInt(epdata.absolute_number) || null,
            title: epdata.EpisodeName,
            alt_titles: [],
            first_aired: parseInt(Date.parse(epdata.FirstAired) / 1000) || null,
            lang: epdata.Language,
            lastupdated: epdata.lastupdated || parseInt(Date.now() / 1000),
            people: {
                        director: this._tvdb_split(epdata.Director),
                        writers: this._tvdb_split(epdata.Writer),
                        guests: this._tvdb_split(epdata.GuestStars),
                        actors: []
                    },
            xref: {
                    tvdb: epdata.id,
                    tvdb_season: epdata.seasonid || null,
                    tvdb_series: epdata.seriesid || null,
                    imdb: epdata.IMDB_ID || null,
                    production_code: epdata.ProductionCode || null
                  },
            synopsis: {
                        tvdb: epdata.Overview
                      },
            images: [{
                        source: 'tvdb',
                        id: `${epdata.seriesid}-${epdata.id}`,
                        type: 'screenshot',
                        url: `http://thetvdb.com/banners/${epdata.filename}`,
                        default: true,
                        selected: false
                    }],
            default_synopsis: 'tvdb',
            scrape_time: parseInt(Date.now() / 1000)
        };

        newep._id = Scraper.mkid_episode(serid, newep);
        return newep
    }

    _tvdb_split(instr) {
        try {
            return instr.split('|').filter(function(x) { return x.length; });
        } catch(e) {
            logthis.warning("Failed to split '%s'", instr, e);
            return [];
        }
    }
}

ADB_RESLUT = {
    1: "AnimeNewsNetwork",
    2: "MyAnimeList",
    3: "AnimeNFO",
    4: "Official Website",
    5: "Official English Website",
    6: "English Wikipedia",
    7: "Japanese Wikipedia",
    8: "Cal Syoboi",
    9: "Allcinema",
    10: "Anison",
    11: ".lain",
    14: "Visual Novel Database",
    15: "Marumegane",
    16: "Animemorial",
    17: "TV Animation Museum",
    19: "Korean Wikipedia",
    20: "Chinese Wikipedia",
    22: "Facebook",
    23: "Twitter",
    26: "YouTube",
    28: "crunchyroll"
}

ADB_EPTYPE = {
    1: "regular",
    2: "special",
    3: "oped",
    4: "promo",
    5: "parody",
    6: "other"
}

class Scraper_anidb extends Scraper {

    /* Usage: Scraper_tvdb({baseuri: '', client: '', banner_path: ''}) */
    constructor(conf) {
        super();
        if(typeof conf == 'undefined') conf = settings.get('scrapers.anidb');
        this._conf = _.defaults({baseuri: 'http://api.anidb.net:9001/httpapi',
                                 series_title_lang: 'main',
                                 episode_title_lang: 'en',
                                 tvdb_supplement: true}, conf);
        this.auth_token = null;
        this._request = request.defaults({baseUrl: `${this._conf.baseuri}`, qs: {client: 'tsukimi', clientver: '1', protover: '1'},
                                          headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});
        this._sreq = request.defaults({baseUrl: "https://tsukimi.io/api", json: true,
                                       headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});

        if(this._conf.tvdb_supplement) {
            this._tvdb = new Scraper_tvdb();
        } else {
            this._tvdb = null;
        }
    }

    static describe() {
        return {
                name: "anidb",
                author: "J. Hipps <jacob@ycnrg.org>",
                description: "AniDB",
                source_url: "https://anidb.net/",
                logo: "https://ss.ycnrg.org/anidb.png",
                image_provider: ['poster']
               };
    }

    search_series(sername, _cbx) {
        this._sreq({ uri: "/search/anime", qs: {series: sername} }, function(err, resp, body) {
            if(resp.statusCode == 200) {
                if(body.error == 'ok') {
                    _cbx({ status: "ok", results: body.results });
                } else {
                    _cbx({ status: "error", error: body.error });
                }
            } else {
                logger.warning("query failed", { serid: serid, statusCode: resp.statusCode, body: body });
                _cbx({ status: "error", error: "Server error: "+body });
            }
        });
    }

    get_series(serid, _cbx) {
        var _this = this;

        _this._sreq({ uri: "/anidb/" + serid }, function(err, resp, body) {
            var cordata;

            if(!err && body.error == 'ok') {
                cordata = body.data;
            } else {
                logger.error("Failed to fetch correlation data from tsukimi.io");
                _cbx({ status: "error", error: "Failed to fetch data from tsukimi.io"});
                return;
            }

            _this._request({ uri: '', qs: {request: 'anime', aid: serid} }, function(err, resp, body) {
                if(resp.statusCode == 200) {
                    // decode XML response
                    xml2js.parseString(body, function(err, result) {
                        if(!err) {
                            // get data from result
                            logger.debug2("raw decoded XML response", { result: result });
                            if(result.error) {
                                logger.error("AniDB returned an error: %s", result.error);
                                _cbx({ status: "error", error: result.error });
                                return;
                            }
                            var xdata = result.anime[0];

                            // get tvdb supplement (if enabled), then process for the final result
                            _this.get_tvdb_supplement(cordata.xref.tvdb, function(tdata) {
                                _this.anidb_process(xdata, cordata, tdata, function(outdata) {
                                    logger.debug("Retrieved series & episode data OK", { serid: outdata._id, outdata: outdata });
                                    _cbx({ status: "ok", result: outdata });
                                });
                            });
                        } else {
                            logger.error("Failed to parse XML response from AniDB", err);
                            _cbx({ status: "error", error: "Failed to parse XML response" });
                        }
                    });
                    //_cbx({ status: "ok", results: body.data });
                } else {
                    logger.warning("AniDB API request failed", { serid: serid, statusCode: resp.statusCode, body: body });
                    _cbx({ status: "error", error: "Server error: "+body });
                }
            });
        });
    }

    get_tvdb_supplement(tvdb_id, _cbx) {
        var _this = this;

        if(_this._tvdb) {
            _this._tvdb.get_series(tvdb_id, function(odata) {
                if(odata.status == 'ok') {
                    logger.debug("Got TVDb supplementary data OK (tvdb_id = %s)", tvdb_id);
                    _cbx(odata.result);
                } else {
                    logger.warning("Failed to retrieve TVDb supplementary data (tvdb_id = %s)", tvdb_id);
                    _cbx(null);
                }
            });
        } else {
            logger.debug("TVDb supplementary data lookup disabled by user configuration (scrapers.anidb.tvdb_supplement)");
            _cbx(null);
        }
    }

    anidb_process(rdata, cdata, tdata, _cbx) {
        var _this = this;
        var iser = Scraper._fix_xml_result(rdata.anime);

        // get main title
        var sertitle;
        try {
            sertitle = iser.titles.title.filter(function(x) { return x.$.type == 'main'; })[0]._;
        } catch(e) {
            sertitle = null;
        }

        // get airing status
        var astatus;
        if(iser.enddate) {
            if(Date.now() >= Date.parse(iser.enddate)) {
                astatus = 'completed';
            } else if(Date.now() >= Date.parse(iser.startdate)) {
                astatus = 'airing';
            } else {
                astatus = 'planned';
            }
        } else if(iser.startdate) {
            if(Date.now() >= Date.parse(iser.startdate)) {
                astatus = 'airing';
            } else {
                astatus = 'planned';
            }
        } else {
            astatus = 'unknown';
        }

        // get key series data
        var txc = {
                    genre: iser.tags.tag.filter(function(x) { return parseInt(x.$.weight) >= 400; }).map(function(x) { return _.startCase(x.name[0]); }),
                    ctitle: sertitle,
                    alt_titles: iser.titles.title.filter(function(x) { return x.$.type != 'main'; }).map(function(x) { return x._; }),
                    lastupdated: parseInt(Date.now() / 1000),
                    xrefs: {
                            anidb: iser.$.id
                           },
                    tv: {
                            studio: iser.creators.name.filter(function(x) { return x.$.type == 'Animation Work'; }).map(function(x) { return x._; }),
                            debut: (parseInt(Date.parse(iser.startdate) / 1000) || null)
                        },
                    synopsis: {
                                anidb: _this._strip_anidb_tags(iser.description)
                              },
                    default_synopsis: 'anidb',
                    status: astatus,
                    fetched: parseInt(Date.now() / 1000),
                    artwork: {
                        banner: [],
                        posters: [],
                        fanart: [],
                        season: []
                    }
        };

        // set series ID
        txc._id = Scraper.mkid_series(null, txc);

        // set correlation datas
        ['tvdb', 'imdb', 'tmdb'].forEach(function(tref) {
            if(cdata.xref[tref]) txc.xrefs[tref] = cdata.xref[tref];
        });

        // set data from tvdb, if available
        if(tdata) {
            txc.tv.network = tdata.tv.network;
            txc.tv.dayslot = tdata.tv.dayslot;
            txc.tv.timeslot = tdata.tv.timeslot;
            txc.synopsis.tvdb = tdata.synopsis.tvdb;
            txc.artwork = tdata.artwork;
        }

        // get episodes
        txc.episodes = [];
        for(tei in iser.episodes.episode) {
            var tep = Scraper._fix_xml_result(iser.episodes.episode[tei]);

            // get episode title
            var eptit = null;
            try {
                eptit = tep.title.filter(function(x) { return x.$['xml:lang'] == _this.conf.episode_title_lang; })[0]._;
            } catch(e) {
                try {
                    eptit = tep.title[0]._;
                } catch(ee) {}
            }

            // get season/ep number
            var epi_sea, epi_num;
            if(parseInt(tep.epno._)) {
                epi_sea = 1;
                epi_num = parseInt(tep.epno._);
            } else {
                epi_sea = 0;
                epi_num = parseInt(tep.epno._.slice(1)) || null;
            }

            // build episode object
            var xdat = {
                _id: null,
                series_id: txc._id,
                season: epi_sea,
                episode: epi_num,
                episode_special: epi_num === null ? tep.epno._ : null,
                episode_absolute: null,
                eptype: ADB_EPTYPE[parseInt(tep.epno.$.type)],
                title: eptit,
                alt_titles: tep.title.map(function(x) { return {title: x._, lang: x.$['xml:lang'] } }),
                first_aired: parseInt(Date.parse(tep.airdate) / 1000) || null,
                lang: _this.conf.episode_title_lang,
                lastupdated: parseInt(Date.now() / 1000),
                people: {
                            director: [],
                            writers: [],
                            guests: [],
                            actors: []
                        },
                xref: {
                        anidb: tep.$.id
                      },
                synopsis: {
                            anidb: _this._strip_anidb_tags(tep.summary)
                          },
                images: [],
                default_synopsis: 'anidb',
                scrape_time: parseInt(Date.now() / 1000)
            };
            xdat._id = Scraper.mkid_episode(txc._id, xdat);

            // merge data from tvdb, if available
            if(tdata) {
                // correlate AniDB episode to TVDb episode using correlation data
                var tvid = _this.get_matching_tvdb_episode(tep.epno._, cdata);
                var emat = tdata.episodes.filter(function(x) { return x.episode == tvid.episode && x.season == tvid.season; });
                if(emat) {
                    var tvdat = emat[0];
                    xdat.xref.tvdb = tvdat.xref.tvdb;
                    xdat.episode_map = {
                        tvdb: {season: tvid.season, episode: tvid.episode},
                        anidb: {season: epi_sea, episode: epi_num || tep.epno._}
                    };
                    xdat.people = tvdat.people;
                    xdat.synopsis.tvdb = tvdat.synopsis.tvdb;
                    xdat.images = tvdat.images;
                }
            }

            txc.episodes.push(xdat);
        }

        _cbx(txc);
    }

    get_matching_tvdb_episode(epnum, cordat) {
        //cdata.episode_offset
        var anidb_episode, anidb_season;
        var tvdb_episode, tvdb_season;

        anidb_episode = parseInt(epnum) || null;
        anidb_season = 1;

        // handle specials (specials are season 0)
        if(anidb_episode === null) {
            anidb_episode = parseInt(epnum.slice(1)) || null;
            anidb_season = 0;
        }

        // set defaults if there are no mappings matched
        tvdb_episode = anidb_episode + parseInt(cordat.episode_offset);
        tvdb_season = parseInt(cordat.default_season);

        cordat.mapping.forEach(function(tmap) {
            if(parseInt(tmap.season_anidb) == anidb_season) {
                if(tmap.maplist[String(anidb_episode)]) {
                    tvdb_episode = parseInt(tmap.maplist[String(anidb_episode)]);
                    tvdb_season = parseInt(tmap.season_tvdb);
                } else if(tmap.start) {
                    if(anidb_episode >= parseInt(tmap.start) && anidb_episode <= parseInt(tmap.end)) {
                        tvdb_episode = anidb_episode + parseInt(tmap.offset);
                        tvdb_season = parseInt(tmap.season_tvdb);
                    }
                }
            }
        });

        return {season: tvdb_season, episode: tvdb_episode};
    }

    _strip_anidb_tags(instr) {
        return instr.replace(/http:.+\[([^\]]+)\]/ig, '$1').replace(/\nSource:\s+.{3,32}$/, '');
    }
}


/** Exports **/

exports.Scraper = Scraper;
exports.Scraper_tvdb = Scraper_tvdb;
exports.Scraper_anidb = Scraper_anidb;
