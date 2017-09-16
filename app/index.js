/**
 ******************************************************************************
 *
 * app/index.js
 * Main Electron Entry Point
 *
 * Copyright (c) 2016-2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

const electron = require('electron');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const C = require('chalk');
const parseArgs = require('minimist');
const mkdirp = require('mkdirp');

const pkgdata = require('../package');
const db = require('./core/tsk_db');
const player = require('./core/player');
global.logger = require('./core/logthis');

const {app, ipcMain} = electron;

let windowMain;

// default settings
// TODO: we need to move this into its own file or something
global.settings = {
                    "mongo": "mongodb://localhost:27017/tsukimi",
                    "data_dir": "%/tsukimi",
                    "xbake_path": "/usr/local/bin/xbake",
                    "mpv_path": "/usr/bin/mpv",
                    "mpv_options": {
                        "fullscreen": false,
                        "pulseaudio_name": "tsukimi",
                        "volume_gain": 0
                    },
                    "groups": {
                        "tv": "TV",
                        "anime": "Anime",
                        "film": "Film",
                        "documentary": "Documentary",
                        "cartoon": "Cartoon",
                        "music_video": "Music Video"
                    }
                };

global.xconf = {
                config_files: [ '%/tsukimi/settings.json', '~/.tsukimi/settings.json', '/opt/tsukimi/settings.json', './settings.json' ],
                default_path: '%/tsukimi/settings.json',
                local_path: null,
                status: 'not_ready'
            };



// Initialization process
(function() {
    var gitdata = gitInfo();
    showBanner(gitdata);
    tskParseArgs(process.argv, function(errA) {
        // print version info
        logger.info("starting: tsukimi version %s", pkgdata.version);

        if(gitdata.ref) logger.info("Git commit ref %s (%s)", gitdata.sref, gitdata.tstamp);
        else logger.info("Non-Git release");

        logger.info("Electron v%s - <https://electron.atom.io/>", process.versions.electron);
        logger.info("Chromium v%s - <https://www.chromium.org/>", process.versions.chrome);
        logger.info("Node.js v%s - <https://nodejs.org/>", process.versions.node);

        db.connect(settings.mongo, function(err) {
            if(!err) {
                xconf.status = 'ready';
            } else {
                xconf.status = 'failed';
            }
        });
    });
})();

app.on('ready', function() {
    windowMain = new electron.BrowserWindow({width: 1024, height: 768});
    windowMain.loadURL('file://' + __dirname + '/public/index.html');
    logger.info("Created main window");

    if(process.platform != 'darwin') {
        windowMain.setMenu(null);
    }

    // spawn dev tools
    windowMain.openDevTools();
});

app.on('window-all-closed', function() {
    if(process.platform != 'darwin') {
        logger.info("All windows closed; Terminating");
        app.quit();
    }
});

app.on('closed', function() {
    windowMain = null;
    logger.debug("windowMain closed");
});

ipcMain.on('async', function(event, arg) {
    logger.debug("Got async event from renderer:", arg);
    event.sender.send('async-reply', "ok");
});

ipcMain.on('sync', function(event, arg) {
    logger.debug("Got sync event from renderer:", arg);
    event.returnValue = "ok";
    windowMain.webContents.send("hi");
});

function tskParseArgs(args, _cbx) {
    var opts = parseArgs(args);

    // loglevel
    if(opts.loglevel) {
        if(opts.loglevel.toLowerCase() in logger.levels) {
            logger.level = opts.loglevel.toLowerCase();
            logger.transports['console-logger'].level = logger.level;
        } else {
            logger.error("Invalid loglevel specified: %s", C.white(opts.loglevel));
            logger.error("Valid levels: %s", C.cyan(Object.keys(logger.levels).join(", ")));
        }
    }

    // xloglevel - Extra loglevel (Mongo and other transports)
    if(opts.xloglevel) {
        if(opts.xloglevel.toLowerCase() in logger.levels) {
            logger.transports['mongo-logger'].level = opts.xloglevel.toLowerCase();
        } else {
            logger.error("Invalid xloglevel specified: %s", C.white(opts.xloglevel));
            logger.error("Valid levels: %s", C.cyan(Object.keys(logger.levels).join(", ")));
        }
    }

    // config file
    if(opts.config) {
        xconf.config_files.push(opts.config);
    }

    logger.debug("raw args: %j", opts, {});

    tskLoadLocalConfig(function(err) {
        if(!err) {
            logger.info("Configuration loaded");
        } else {
            logger.error("Failed to load configuration");
        }
        if(_cbx) _cbx(err);
    });
}

function expandPath(inpath) {
    var confile = inpath;

    if(confile[0] == '~') {
        if(process.platform == 'win32') {
            confile = path.join(process.env.HOMEPATH, confile.slice(1));
        } else {
            confile = path.join(process.env.HOME, confile.slice(1));
        }
    } else if(confile[0] == '%') {
        if(process.platform == 'win32') {
            confile = path.join(process.env.APPDATA, confile.slice(1));
        } else if(process.platform == 'darwin') {
            confile = path.join(process.env.HOME, 'Library', confile.slice(1));
        } else {
            confile = path.join(process.env.HOME, '.config', confile.slice(1));
        }
    }

    return confile;
}

function tskLoadLocalConfig(_cbx) {
    // find first-available config file
    var cpath = null;
    for(icon in xconf.config_files) {
        var confile = expandPath(xconf.config_files[icon]);
        try {
            fs.accessSync(confile);
            cpath = confile;
            break;
        } catch(err) {
            continue;
        }
    }

    // create new config
    if(cpath === null) {
        cpath = expandPath(xconf.default_path);
        xconf.local_path = cpath;
        logger.warning("No existing local configuration found; creating new local config at default platform-specific path: %s", cpath);
        settings.data_dir = expandPath(settings.data_dir);
        tskSaveLocalConfig(_cbx);
    // parse existing config
    } else {
        xconf.local_path = cpath;
        try {
            fs.readFile(cpath, function(err, data) {
                if(!err) {
                    var newset = JSON.parse(data);
                    settings = newset;
                    logger.debug("Loaded settings from local config [%s]: ", cpath, newset);
                    _cbx(null);
                } else {
                    logger.error("Failed to parse JSON from local config [%s]: ", cpath, err);
                    _cbx(err);
                }
            });
        } catch(err) {
            logger.error("Failed to read local config [%s]: ", cpath, err);
            _cbx(err);
        }
    }
}

function tskSaveLocalConfig(_cbx) {
    var cpath = xconf.local_path;
    var cdata = JSON.stringify(settings, null, '  ');

    try {
        mkdirp(path.dirname(cpath), { mode: 0775 }, function(err) {
            if(!err) {
                fs.writeFile(cpath, cdata, function(err) {
                    if(!err) {
                        logger.debug("Wrote new local config OK [%s]: ", cpath, cdata);
                        _cbx(null);
                    } else {
                        logger.error("Failed to write local config [%s]: ", cpath, err);
                        _cbx(err);
                    }
                });
            } else {
                logger.error("Failed to create directory for local config [%s]: ", path.dirname(cpath), err);
                _cbx(err);
            }
        });
    } catch(err) {
        logger.error("Failed to write local config [%s]: ", cpath, err);
        _cbx(err);
    }
}

function gitInfo() {
    var xref = (child_process.execSync('git show-ref 2>/dev/null | head -1 | cut -f 1 -d " "').toString().trim() || null);
    var xdts = (child_process.execSync('git show 2>/dev/null | grep ^Date | awk \'{ print $3" "$4" "$6" "$5 }\'').toString().trim() || null);
    var xurl = (xref ? pkgdata.repository.url+'/commits/'+xref : null);
    var sref = (xref ? xref.substr(-8) : null);
    return { ref: xref, sref: sref, tstamp: xdts, url: xurl };
}

function showBanner(gitdata) {
    // wave the banner
    process.stdout.write("\n");
    process.stdout.write(C.cyan(" ***   ") + C.white("tsukimi") + "\n");
    process.stdout.write(C.cyan(" ***   ") + C.cyan("Version "+pkgdata.version+(gitdata.ref ? " [Commit "+gitdata.sref+" - "+gitdata.tstamp+"]" : "")) + "\n");
    process.stdout.write(C.cyan(" ***   ") + C.green(pkgdata.copyright)+"\n");
    process.stdout.write(C.cyan(" ***   ") + C.green("Jacob Hipps <jacob@ycnrg.org>")+"\n");
    process.stdout.write(C.cyan(" ***   ") + C.yellow("https://tsukimi.io/") + "\n");
    process.stdout.write(C.cyan(" ***   ") + C.yellow("https://ycnrg.org/") + "\n\n");
}

global.getWindowHandle = function() {
    var hwnd = windowMain.getNativeWindowHandle();
    return Buffer.from(hwnd).readUInt32LE(0);
};

// Exports ////
exports.getWindowHandle = getWindowHandle;
exports.db = db;
exports.player = player;