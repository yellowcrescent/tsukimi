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
const os = require('os');
const fs = require('fs');
const path = require('path');
const child_process = require('child_process');
const events = require('events');

const C = require('chalk');
const parseArgs = require('minimist');
const mkdirp = require('mkdirp');
const lowdb = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const _ = require('lodash');

const pkgdata = require('../package');
const db = require('./core/tsk_db');
const player = require('./core/player');
const scrapers = require('./core/scrapers');
const scanner = require('./core/scanner');
const fsutils = require('./core/fsutils');
const utils = require('./core/utils');
const discovery = require('./core/discovery');
global.logger = require('./core/logthis');

const {app, ipcMain, dialog} = electron;

let windowMain;
let lastPosition;
let status = new events.EventEmitter(); // jshint ignore:line

/** Globals **/

global.basepath = app.getAppPath();

global.xconf = {
                config_file: null,
                default_path: '%/tsukimi/settings.json',
                local_path: null,
                status: 'not_ready',
                devtools: false
            };

global.tkversion = {
    tsukimi: pkgdata.version,
    git: {},
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
    arch: os.arch(),
    platform: os.platform()
};

/** Initialization process **/

(function() {
    var gitdata = gitInfo();
    showBanner(gitdata);
    tskParseArgs(process.argv);

    // load local config
    global.settings = new (require('./core/settings').LocalConfig)({ confPath: xconf.config_file });

    // print version info
    logger.info("starting: tsukimi version %s", pkgdata.version);

    if(gitdata.ref) logger.info("Git commit ref %s (%s)", gitdata.sref, gitdata.tstamp);
    else logger.info("Non-Git release");

    logger.info("Electron v%s - <https://electron.atom.io/>", process.versions.electron);
    logger.info("Chromium v%s - <https://www.chromium.org/>", process.versions.chrome);
    logger.info("Node.js v%s - <https://nodejs.org/>", process.versions.node);

    tskDatabaseConnect();

    // get appId and register with Electron
    try {
        global.appId = pkgdata.build ? pkgdata.build.appId : pkgdata.appId;
        app.setAppUserModelId(appId);
    } catch(e) {
        logger.error("appId is not defined! pkgdata:", pkgdata);
    }

    if(appId) {
        logger.info("appId: %s", appId);
    }

    // enforce single-instance application mode
    const isSecondInstance = app.makeSingleInstance(function(cmdline, cwd) {
        if(windowMain) {
            if(windowMain.isMinimized()) windowMain.restore();
            windowMain.focus();
            logger.verbose("Window focused due to second instance execution");
            // TODO: maybe check the cmdline for a file/path and import it?
        }
    });

    if(isSecondInstance) {
        logger.error("Already running in another window. Focused existing instance. Aborting.");
        app.quit();
    }

    // check for GPU acceleration
    //global.gpuinfo = app.getGpuFeatureStatus();
    //logger.debug("GPU feature info:", gpuinfo);
})();


/** Core Electron event handlers **/
status.once('failed', function() {
    status.once('failed', function() {
        // TODO: show error / remote connection dialog
        logger.error("Connection failed. Please check local configuration and re-launch");
        dialog.showErrorBox("tsukimi", "Failed to connect to MongoDB database and auto-discovery failed. Please check configuration and restart.");
        app.quit();
    });

    // for now, just connect to the first available running node
    discovery.findPeers(function(nodelist) {
        if(nodelist.mongo && nodelist.tsukimi) {
            logger.info(`Found tsukimi node: ${nodelist.tsukimi.host} (${nodelist.tsukimi.txt.version}) [${nodelist.tsukimi.txt.platform}/${nodelist.tsukimi.txt.arch}]`);
            logger.info(`Got MongoDB connection string: ${nodelist.mongo.txt.mconnstr}`);
            settings.set('mongo', nodelist.mongo.txt.mconnstr);
            tskDatabaseConnect(function(err) {
                if(!err) {
                    logger.info("Auto-discovery success!");
                } else {
                    logger.error("Auto-discovery failed. Unable to connect to advertised database. Ensure MongoDB is listening on 0.0.0.0 and port is opened in the firewall.");
                }
            });
        }
    });
});

app.on('ready', function() {
    status.on('ready', function() {
        // spawn main client window
        spawnMainWindow();

        // advertise services via zeroconf
        if(settings.get('listen.advertise')) {
            discovery.advertise(function() {
                logger.info("discovery: Advertising services via DNSSD/Zeroconf");
            });
        } else {
            logger.warning("discovery: Advertising services via DNSSD/Zeroconf disabled");
        }
    });
});

app.on('window-all-closed', function() {
    //if(process.platform != 'darwin') {
    // Close on OS X, too. Otherwise, it's damn annoying
    logger.info("All windows closed; Terminating");
    settings.save();
    app.quit();
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


/** Startup utility functions **/

function spawnMainWindow() {
    var winOpts = {
        title: "tsukimi",
        width: settings.get('prefs.window.width'),
        height: settings.get('prefs.window.height'),
        fullscreen: settings.get('prefs.window.fullscreen') ? true : null,
        minWidth: 1280,
        minHeight: 800,
        enableLargerThanScreen: true,
        backgroundColor: '#000'
    };

    if(settings.get('prefs.window.x') !== null && settings.get('prefs.window.x') !== null) {
        winOpts.x = settings.get('prefs.window.x');
        winOpts.y = settings.get('prefs.window.y');
    } else {
        winOpts.center = true;
    }

    windowMain = new electron.BrowserWindow(winOpts);
    windowMain.loadURL('file://' + __dirname + '/public/index.html');
    logger.info("spawnMainWindow: Created main window");

    if(process.platform != 'darwin') {
        windowMain.setMenu(null);
    }

    // spawn dev tools
    if(xconf.devtools) windowMain.openDevTools();

    // restore additional window state
    if(settings.get('prefs.window.maximized')) windowMain.maximize();

    // configure window callbacks
    windowMain.on('move', function() { saveWindowState(); });
    windowMain.on('resize', function() { saveWindowState(); });
    windowMain.on('maximize', function() { saveWindowState(); });
    windowMain.on('unmaximize', function() { saveWindowState(); });
    windowMain.on('enter-full-screen', function() { saveWindowState(); });
    windowMain.on('leave-full-screen', function() { saveWindowState(); });

}

function saveWindowState() {
    var bb = windowMain.getBounds();
    settings.set('prefs.window.width', bb.width);
    settings.set('prefs.window.height', bb.height);
    settings.set('prefs.window.x', bb.x);
    settings.set('prefs.window.y', bb.y);
    settings.set('prefs.window.fullscreen', windowMain.isFullScreen());
    settings.set('prefs.window.maximized', windowMain.isMaximized());
}

function tskDatabaseConnect(_cbx) {
    db.connect(settings.get('mongo'), function(err) {
        if(!err) {
            xconf.status = 'ready';
            status.emit('ready');
        } else {
            xconf.status = 'failed';
            status.emit('failed');
        }

        if(typeof _cbx != 'undefined') {
            _cbx(err);
        }
    });
}

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
        xconf.config_file = opts.config;
    }

    if(opts.devtools) {
        xconf.devtools = true;
    }

    logger.debug("raw args: %j", opts, {});
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

function gitInfo() {
    var xref = (child_process.execSync('git show-ref 2>/dev/null | head -1 | cut -f 1 -d " "').toString().trim() || null);
    var xdts = (child_process.execSync('git show 2>/dev/null | grep ^Date | awk \'{ print $3" "$4" "$6" "$5 }\'').toString().trim() || null);
    var xurl = (xref ? pkgdata.repository.url+'/commits/'+xref : null);
    var sref = (xref ? xref.substr(-8) : null);
    var gout = { ref: xref, sref: sref, tstamp: xdts, url: xurl };
    tkversion.git = gout;
    return gout;
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


/** Dialog & Menu helper functions **/

function createPopupMenu(menudata, x, y) {
    var menu = electron.Menu.buildFromTemplate(menudata);
    menu.popup(windowMain, {x: x, y: y});
}

function openDialog(opts, _cbx) {
    if(!opts.defaultPath) opts.defaultPath = settings.get('prefs.library.lastDir');
    return dialog.showOpenDialog(windowMain, opts, function(flist) {
        if(typeof flist != 'undefined') {
            settings.set('prefs.library.lastDir', path.dirname(flist[0]));
        }
        _cbx(flist);
    });
}

function setFullscreenFlag(flag) {
    windowMain.setFullScreen(flag);
    logger.debug("setFullscreenFlag: flag = %s", (flag ? 'true' : 'false'));
}

function setFullscreen(drect) {
    var display;

    if(typeof drect == 'undefined' || drect === null) {
        display = electron.screen.getDisplayMatching(windowMain.getBounds());
    } else {
        display = electron.screen.getDisplayMatching(drect);
    }
    logger.debug("setFullscreen: display  =", display);

    var dbounds = display.bounds;

    lastPosition = windowMain.getBounds();
    logger.debug("setFullscreen: saved lastPosition =", lastPosition);

    windowMain.setPosition(dbounds.x, dbounds.y);
    windowMain.setSize(dbounds.width, dbounds.height);
    windowMain.setAlwaysOnTop(true);
    logger.debug("setFullscreen: set %d x %d @ %d,%d", dbounds.width, dbounds.height, dbounds.x, dbounds.y);
}

function setWindowed() {
    windowMain.setAlwaysOnTop(false);
    if(lastPosition) {
        windowMain.setSize(lastPosition.width, lastPosition.height);
        windowMain.setPosition(lastPosition.x, lastPosition.y);
        logger.debug("setWindowed: restored geometry from lastPosition");
    } else {
        windowMain.setSize(1920, 1080);
        windowMain.center();
        logger.debug("setWindowed: restored geometry to build-in defaults");
    }
}

global.getWindowHandle = function() {
    var hwnd = windowMain.getNativeWindowHandle();
    return Buffer.from(hwnd).readUInt32LE(0);
};

// Exports ////
exports.getWindowHandle = getWindowHandle;
exports.createPopupMenu = createPopupMenu;
exports.openDialog = openDialog;
exports.setFullscreen = setFullscreen;
exports.setFullscreenFlag = setFullscreenFlag;
exports.setWindowed = setWindowed;

exports.db = db;
exports.scrapers = scrapers;
exports.scanner = scanner;
exports.player = player;
exports.fsutils = fsutils;
exports.utils = utils;
