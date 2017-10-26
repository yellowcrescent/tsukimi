/**
 ******************************************************************************
 *
 * app/settings.js
 * Main settings class
 *
 * Copyright (c) 2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

const os = require('os');
const fs = require('fs');
const path = require('path');

const electron = require('electron');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const defaults = {
    "mongo": "mongodb://localhost:27017/tsukimi",
    "data_dir": "%/tsukimi",
    "xbake_path": "/usr/local/bin/xbake",
    "mpv_path": "/usr/bin/mpv",
    "mpv_options": {
        "fullscreen": false,
        "pulseaudio_name": "tsukimi",
        "volume_gain": 0,
        "legacy_options": false,
        "xdisplay": null
    },
    "groups": {
        "tv": "TV",
        "anime": "Anime",
        "film": "Film",
        "documentary": "Documentary",
        "cartoon": "Cartoon",
        "music_video": "Music Video"
    },
    "scrapers": {
        "global": {
            "repdelay": 500,
            "default_scraper": "tvdb"
        },
        "tvdb": {},
        "anidb": {
            "series_title_lang": "main",
            "episode_title_lang": "en",
            "tvdb_supplement": true
        }
    },
    "listen": {
        "port": 22022,
        "advertise": true,
        "service_name": os.hostname().split('.')[0] + '-' + 'tsukimi'
    },
    "prefs": {
        "window": {
            "x": null,
            "y": null,
            "width": 1760,
            "height": 1040,
            "fullscreen": false,
            "maximized": false
        },
        "library": {
            "lastDir": os.homedir()
        }
    }
};

class LocalConfig{
    constructor(opts) {
        this.confPath = path.join((electron.app || electron.remote.app).getPath('userData'), 'settings.json');

        if(typeof opts != 'undefined') {
            if(opts.confPath) {
                this.confPath = opts.confPath;
            }
        }

        this.adapter = new FileSync(this.confPath);
        this.cdb = low(this.adapter);
        if(this.cdb) {
            logger.info("Using config at %s", this.confPath);
        } else {
            logger.info("Failed to spawn config using file at %s", this.confPath);
        }

        this.cdb.defaults(defaults).write();
    }

    get(k) {
        return this.cdb.get(k).value();
    }

    set(k, v) {
        this.cdb.set(k, v).write();
        //logger.debug("LocalConfig->set: %s -> '%s'", k, v);
    }

    save() {
        this.cdb.write();
        logger.debug("LocalConfig->save: wrote config to disk", this.cdb.getState());
    }

    sync() {
        this.cdb.read();
        logger.debug("LocalConfig->sync: Reloaded config from disk");
    }

    dump() {
        return this.cdb.getState();
    }
}


/** Exports **/
exports.defaults = defaults;
exports.LocalConfig = LocalConfig;
