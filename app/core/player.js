/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * player.js
 * Player launcher for mpv
 *
 * Copyright (c) 2017 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

const child_process = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const logger = require('./logthis');
const net = require('net');

var mpv_sockpath = path.join(os.tmpdir(), 'mpv.sock');

exports.mpv_play = function(infile, xargs, _cbx) {

    // check if target exists and is a file
    try {
        var dstat = fs.statSync(infile);
        if(!dstat.isFile()) {
            _cbx({ msgtype: "_exception", msg: "Selected file is not a regular file" });
            logger.error("mpv_play: '%s' is not a regular file; aborting", infile);
            return;
        }
    } catch(e) {
        _cbx({ msgtype: "_exception", msg: "Error accessing selected video file for playback" });
        logger.error("mpv_play: Error accessing selected video file '%s'", infile);
        return;
    }

    // build mpv options
    var menv = process.env;
    var mopts = [];
    if(settings.mpv_options.pulseaudio_name) mopts.push('--audio-client-name=' + settings.mpv_options.pulseaudio_name.replace(/ /g, '_'));
    if(settings.mpv_options.volume_gain) mopts.push(['-af', 'volume=' + settings.mpv_options.volume_gain]);
    if(settings.mpv_options.fullscreen) {
        mopts.push('--fs');
        logger.debug("mpv_play: Playing video fullscreen");
        if(settings.mpv_options.xdisplay) {
            menv.DISPLAY = ':' + settings.mpv_options.xdisplay;
            logger.debug("mpv_play: Playing on X display :%s", settings.mpv_options.xdisplay);
        }
    } else {
        if(os.platform() == 'darwin') {
            logger.warning("mpv_play: Window overlay not supported on OS X. Playing in standalone window.")
        } else {
            if(settings.mpv_options && settings.mpv_options.standalone) {
                logger.debug("mpv_play: Playing in standalone window (settings.mpv_options.standalone == true)");
            } else {
                var hwnd = getWindowHandle();
                if(hwnd) {
                    mopts.push('--wid=' + hwnd);
                    logger.debug("mpv_play: Playing video overlay; hwnd = %s", hwnd);
                } else {
                    logger.warning("mpv_play: Unable to determine native window handle; playing in standalone window");
                }
            }
        }
    }

    if(xargs.sub_track) mopts.push('--sid=' + xargs.sub_track);
    if(xargs.audio_track) mopts.push('--aid=' + xargs.audio_track);
    mopts.push('--quiet', infile);
    if(settings.mpv && settings.mpv.legacy_options) {
        mopts.push('--input-unix-socket=' + mpv_sockpath);
    } else {
        mopts.push('--input-ipc-server=' + mpv_sockpath);
    }

    // spawn mpv process
    logger.debug("mpv_play: Executing: `%s %s`", settings.mpv_path, mopts.join(' '));
    var mpv = child_process.spawn(settings.mpv_path, mopts, {env: menv});

    // set up event listeners
    var mpv_started = false;
    mpv.stdout.on('data', function(data) {
        if(!mpv_started) {
            _cbx({ msgtype: "_start", file: infile });
            mpv_ipc_client(_cbx);
            mpv_started = true;
        }
        logger.debug("[mpv] " + data.toString());
    });

    mpv.on('close', function(exitCode) {
        _cbx({ msgtype: "_close", file: infile, exitcode: exitCode });
    });

};

function mpv_ipc_client(evt_cbx) {

    logger.debug("[mpv_ipc_client] establishing IPC connection...");
    var sock = new net.Socket();
    sock.connect(mpv_sockpath, function() {
        logger.debug("[mpv_ipc_client] connected to mpv JSON IPC interface");
        if(evt_cbx) {
            evt_cbx({ msgtype: "_ipc_control", status: "connect", sock: sock.write });
        }
    });

    sock.on('data', function(data) {
        logger.debug("[mpv_ipc_client] %s", data);
        if(evt_cbx) {
            evt_cbx({ msgtype: "_ipc_data", data: data });
        }

    });

    sock.on('close', function() {
        logger.debug("[mpv_ipc_client] IPC connection closed");
        if(evt_cbx) {
            evt_cbx({ msgtype: "_ipc_control", status: "disconnect" });
        }
    });

}
