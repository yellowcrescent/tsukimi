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

var tvdb_baseuri = "https://api.thetvdb.com";
var tvdb_apikey = "DE1C5FD2150BEE8D";

var tvdb_token = null;
var trequest = request.defaults({ baseUrl: tvdb_baseuri, json: true, headers: { 'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)" } });


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
					console.log("Authenticated to thetvdb OK; bearer token: "+tvdb_token);
					trequest = trequest.defaults({ headers: { 'Authorization': "Bearer "+tvdb_token } });
					_cbx(null);
				} else {
					console.log("ERROR: Unexpected response data; data: ",body);
					_cbx(body.Error);
				}
			} else {
				console.log("ERROR: Failed to authenticate to thetvdb; response code: "+resp.statusCode);
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
					console.log("got "+body.length+" results from tvdb:",body);
					_cbx({ status: "ok", results: body.data });
				} else if(resp.statusCode == 404) {
					console.log("tvdb query returned no results");
					_cbx({ status: "ok", results: [] });
				} else if(resp.statusCode == 401) {
					console.log("ERROR: 401 Unauthorized");
					_cbx({ status: "error", error: "Unauthorized", results: [] });
				} else {
					console.log("ERROR: thetvdb query failed; response code: "+resp.statusCode);
					_cbx({ status: "error", error: "Server error: "+body.Error, results: [] });
				}
			});
		} else {
			_cbx({ status: "error", error: "Unable to authenticate to thetvdb: "+err });
		}
	});
}

/**
 * Exports
 **/

exports.tvdb_search			= tvdb_search;
