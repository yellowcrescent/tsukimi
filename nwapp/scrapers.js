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

var request = require('request');
var pkgdata = require("./package");
var xml2js = require('xml2js');
var logthis = require('./logthis');

var tvdb_baseuri = "https://api.thetvdb.com";
var tvdb_apikey = "DE1C5FD2150BEE8D";
var tvdb_banpath = "http://thetvdb.com/banners";

var tvdb_token = null;
var trequest = request.defaults({ baseUrl: tvdb_baseuri, json: true, headers: { 'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)" } });
var xrequest = request.defaults({ baseUrl: "http://thetvdb.com/api/"+tvdb_apikey, headers: { 'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)" } });


function tvdb_auth(_cbx) {
	if(tvdb_token) {
		// if we already have a token, we're good to go
		_cbx(null);
	} else {
		// otherwise, send the auth request
		trequest({ uri: '/login', method: 'POST', body: { apikey: tvdb_apikey } }, function(err,resp,body) {
			if(resp.statusCode == 200) {
				if(body.token) {
					// we got the token! save it for later
					tvdb_token = body.token;
					logthis.verbose("Authenticated to thetvdb OK; bearer token: %s", tvdb_token);
					trequest = trequest.defaults({ headers: { 'Authorization': "Bearer "+tvdb_token } });
					_cbx(null);
				} else {
					logthis.error("Unexpected response data", { body: body });
					_cbx(body.Error);
				}
			} else {
				logthis.error("Failed to authenticate to thetvdb", { statusCode: resp.statusCode, body: body });
				_cbx(body.Error);
			}
		});
	}
}

function tvdb_search(qseries, _cbx) {
	tvdb_auth(function(err) {
		if(!err) {
			trequest({ uri: '/search/series', qs: { name: qseries } }, function(err,resp,body) {
				if(resp.statusCode == 200) {
					logthis.verbose("got %d results from tvdb", body.data.length, { qseries: qseries, body: body });
					_cbx({ status: "ok", results: body.data });
				} else if(resp.statusCode == 404) {
					logthis.warning("tvdb query returned 404 No Results", { qseries: qseries });
					_cbx({ status: "ok", results: [] });
				} else if(resp.statusCode == 401) {
					logthis.warning("tvdb returned 401 Unauthorized");
					_cbx({ status: "error", error: "Unauthorized", results: [] });
				} else {
					logthis.warning("thetvdb query failed; response code: "+resp.statusCode);
					_cbx({ status: "error", error: "Server error: "+body.Error, results: [] });
				}
			});
		} else {
			_cbx({ status: "error", error: "Unable to authenticate to thetvdb: "+err });
		}
	});
}

function tvdb_get_series_v2(serid, _cbx) {
	tvdb_auth(function(err) {
		if(!err) {
			// get series info
			trequest({ uri: '/series/'+serid }, function(err,resp,body) {
				if(resp.statusCode == 200) {
					var serdata = body.data;
					logthis.verbose("got series data OK");
					// get episodes
					tvdb_get_episodes_v2(serid, 1, [], function(epdata) {
						_cbx({ status: "ok", serdata: serdata, episodes: epdata });
					});
				} else {
					logthis.warning("thetvdb query failed", { serid: serid, statusCode: resp.statusCode, body: body });
					_cbx({ status: "error", error: "Server error: "+body.Error });
				}
			});
		} else {
			_cbx({ status: "error", error: "Unable to authenticate to thetvdb: "+err });
		}
	});
}

function tvdb_get_episodes_v2(serid, page, lastdata, _cbx) {
	tvdb_auth(function(err) {
		if(!err) {
			// get episodes
			trequest({ uri: '/series/'+serid+'/episodes', qs: { page: page } }, function(err,resp,body) {
				if(resp.statusCode == 200) {
					var newdata = lastdata.concat(body.data);
					logthis.verbose("got %d episodes from tvdb. next: %s ", body.data.length, body.links.next);
					if(body.links.next) {
						tvdb_get_episodes_v2(serid, body.links.next, newdata, _cbx);
					} else {
						_cbx(newdata);
					}
				} else {
					logthis.warning("thetvdb query failed", { serid: serid, statusCode: resp.statusCode, body: body });
					_cbx({ status: "error", error: "Server error: "+body.Error, results: [] });
				}
			});
		} else {
			_cbx({ status: "error", error: "Unable to authenticate to thetvdb: "+err });
		}
	});
}

function tvdb_get_series(serid, _cbx) {
	// get episodes
	logthis.verbose("fetching tvdb data for series ID '%s'", serid);
	xrequest({ uri: '/series/'+serid+'/all/en.xml' }, function(err,resp,body) {
		if(resp.statusCode == 200) {
			logthis.debug("got series data from tvdb; parsing XML response");
			// decode XML response
			xml2js.parseString(body, function(err,result) {
				if(!err) {
					// get data from result
					logthis.debug("raw decoded XML response", { result: result });
					var xdata = result.Data;
					tvdb_process(xdata, function(outdata) {
						logthis.verbose("Retrieved series, episode, and banner data OK", { serid: serid, outdata: outdata });
						_cbx({ status: "ok", result: outdata });
					});
				} else {
					logthis.warning("failed to parse XML response from tvdb", { error: err });
					_cbx({ status: "error", error: "Failed to parse XML response" });
				}
			});
		} else {
			logthis.warning("thetvdb query failed", { serid: serid, statusCode: resp.statusCode, body: body });
			_cbx({ status: "error", error: "Server error: "+body });
		}
	});
}

function tvdb_process(indata, _cbx) {
	var outdata = {};
	var iser = fix_xml_result(indata.Series[0]);

	// get key series data
	var txc = {
				genre: iser.Genre.split('|').filter(function(x) { return x ? true : false; }),
				ctitle: iser.SeriesName,
				lastupdated: (iser.lastupdated || parseInt(Date.now() * 1000.0)),
				status: (iser.Status || 'unknown'),
				fetched: parseInt(Date.now() / 1000),
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
						  }
			  };

	// get episodes
	txc.episodes = [];
	for(tei in indata.Episode) {
		txc.episodes[tei] = fix_xml_result(indata.Episode[tei]);
	}

	// get banner defaults
	var bandefs = {
					banners: iser.banner,
					fanart: iser.fanart,
					poster: iser.poster
				  };

	// fetch all artwork
	tvdb_get_artwork(txc.xrefs.tvdb, bandefs, function(artlist) {
		// set artwork
		txc.artwork = artlist;
		// and return with completed data struct
		_cbx(txc);
	});
}

function tvdb_get_artwork(serid, adefs, _cbx) {
	var xdout = { banners: [], fanart: [], poster: [], season: [] };
	xrequest({ uri: '/series/'+serid+'/banners.xml' }, function(err,resp,body) {
		if(resp.statusCode == 200) {
			logthis.debug("got banner data from tvdb; parsing XML response", { serid: serid });
			// decode XML response
			xml2js.parseString(body, function(err,result) {
				if(!err) {
					// get data from result
					logthis.debug("raw decoded XML response", { result: result });
					var blist = result.Banners.Banner;
					for(bi in blist) {
						var bb = fix_xml_result(blist[bi]);
						var bantype = bb.BannerType.trim().toLowerCase();
						var tart =  {
										url: tvdb_banpath+'/'+bb.BannerPath,
										path: bb.BannerPath,
										type2: bb.BannerType2,
										tvdb_id: bb.id,
										lang: bb.Language,
										season: (bb.Season || '0'),
										default: false,
										selected: false
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
							logthis.warning("unknown banner type encountered. bantype: %s", bantype);
						}
					}

					_cbx(xdout);
				} else {
					logthis.warning("failed to parse XML response from tvdb", { error: err });
					_cbx(null);
				}
			});
		} else {
			logthis.warning("thetvdb query failed", { serid: serid, statusCode: resp.statusCode, body: body });
			_cbx(null);
		}
	});
}

function fix_xml_result(inarr) {
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

/**
 * Exports
 **/

exports.tvdb_search			= tvdb_search;
exports.tvdb_get_series		= tvdb_get_series;

exports.__tvdb_auth			= tvdb_auth;
exports.__tvdb_token		= tvdb_token;
exports.__tvdb_apikey		= tvdb_apikey;
