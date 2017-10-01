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
var xml2js = require('xml2js');

var pkgdata = require("../../package");
var logger = require('./logthis');

class Scraper {

    /* These methods should be implemented by the subclass */
    auth() {
        logger.error("Method not implemented");
        return null;
    }

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
    fetch_series_images() {

    }

    fetch_episode_images() {

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
        this._conf = conf;
        this._request = request.defaults({baseUrl: `${this._conf.baseuri}/${this._conf.apikey}`,
                                          headers: {'User-Agent': "tsukimi/"+pkgdata.version+" (https://tsukimi.io/)"}});

    }
}
