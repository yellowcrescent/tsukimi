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
const _ = require('lodash');
const EventEmitter = require('events');

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
    if(settings.get('mpv_options.pulseaudio_name')) mopts.push('--audio-client-name=' + settings.get('mpv_options.pulseaudio_name').replace(/ /g, '_'));
    if(settings.get('mpv_options.volume_gain')) mopts.push('-af=volume=' + settings.get('mpv_options.volume_gain'));
    if(settings.get('mpv_options.fullscreen')) {
        mopts.push('--fs');
        logger.debug("mpv_play: Playing video fullscreen");
        if(settings.get('mpv_options.xdisplay')) {
            menv.DISPLAY = ':' + settings.get('mpv_options.xdisplay');
            logger.debug("mpv_play: Playing on X display :%s", settings.get('mpv_options.xdisplay'));
        }
    } else {
        if(os.platform() == 'darwin') {
            logger.warning("mpv_play: Window overlay not supported on OS X. Playing in standalone window.")
        } else {
            if(settings.get('mpv_options') && settings.get('mpv_options.standalone')) {
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
    if(settings.get('mpv') && settings.get('mpv.legacy_options')) {
        mopts.push('--input-unix-socket=' + mpv_sockpath);
    } else {
        mopts.push('--input-ipc-server=' + mpv_sockpath);
    }

    // spawn mpv process
    logger.debug("mpv_play: Executing: `%s %s`", settings.get('mpv_path'), mopts.join(' '));
    //var mpv = child_process.spawn(settings.get('mpv_path'), mopts, {env: menv, stdio: 'inherit'});
    var mpv = child_process.spawn(settings.get('mpv_path'), mopts, {env: menv});

    // set up event listeners
    var mpv_started = false;
    mpv.stdout.on('data', function(data) {
        if(!mpv_started) {
            _cbx({ msgtype: "_start", file: infile });
            mpv_ipc_client(_cbx);
            mpv_started = true;
        }
        logger.debug2("[mpv] " + data.toString());
    });

    mpv.on('close', function(exitCode) {
        _cbx({ msgtype: "_close", file: infile, exitcode: exitCode });
    });

};

function mpv_ipc_client(evt_cbx) {

    var event = new EventEmitter();
    var reqid = 0;
    var playstat;

    var sock_writer = function(cmd, args) {
        if(!args) args = [];
        reqid++;
        var ocmdstr = JSON.stringify({command: [cmd].concat(args), request_id: reqid}) + '\n';
        logger.debug2("[mpv_ipc_client] command out: '%s'", ocmdstr.trim());
        sock.write(ocmdstr);
        return reqid;
    };

    logger.debug2("[mpv_ipc_client] establishing IPC connection...");
    var sock = new net.Socket();
    sock.connect(mpv_sockpath, function() {
        logger.debug2("[mpv_ipc_client] connected to mpv JSON IPC interface");
        playstat = {filename: null, paused: false, pl_item: null, pl_tot: null,
                    chapter: null, chapter_list: [], chapter_tot: null, chapter_title: null};
        if(evt_cbx) {
            evt_cbx({ msgtype: "_ipc_control", status: "connect", sock: sock_writer, event: event });
        }
    });

    sock.on('data', function(data) {
        logger.debug("[mpv_ipc_client] %s", data);

        var pdata = String(data).trim().split('\n').map(function(x) { return JSON.parse(x); });
        for(var dseg in pdata) {
            var dchunk = pdata[dseg];

            if(dchunk.request_id) {
                logger.debug2("** mpv->request-response: #%s", dchunk.request_id);
                event.emit(`request-${dchunk.request_id}`, dchunk);
            } else if(dchunk.event) {
                logger.debug2("** mpv->event: %s", dchunk.event);
                event.emit(`event-${dchunk.event}`);
            }
        }
    });

    sock.on('close', function() {
        logger.debug2("[mpv_ipc_client] IPC connection closed");
        if(evt_cbx) {
            evt_cbx({ msgtype: "_ipc_control", status: "disconnect" });
        }
    });

    event.on('event-pause', function() {
        logger.debug2('** mpv->event.on(event-pause)');
        playstat.paused = true;
        event.emit('player-state-updated', playstat);
    });

    event.on('event-unpause', function() {
        logger.debug2('** mpv->event.on(event-unpause)');
        playstat.paused = false;
        event.emit('player-state-updated', playstat);
    });

    event.on('event-file-loaded', function() {
        logger.debug2('** mpv->event.on(event-file-loaded)');
        var treq = sock_writer('get_property', ['playlist']);
        event.once(`request-${treq}`, function(data) {
            logger.debug2('** mpv->event.on(event-file-loaded).once(playlist); data = "%j"', data);
            var tdata = data.data;
            for(var ti in tdata) {
                if(tdata[ti].current) {
                    playstat.filename = tdata[ti].filename;
                    playstat.pl_item = parseInt(ti);
                    break;
                }
            }
            playstat.pl_tot = tdata.length;
            event.emit('player-state-updated', playstat);
        });
    });

    event.on('event-chapter-change', function() {
        logger.debug2('** mpv->event.on(event-chapter-change)');
        var treq = sock_writer('get_property', ['chapter']);
        event.once(`request-${treq}`, function(data) {
            logger.debug2('** mpv->event.on(event-chapter-change).once(chapter); data = "%j"', data);
            var tdata = data.data;
            playstat.chapter = tdata;

            var treq2 = sock_writer('get_property', ['chapter-list']);
            event.once(`request-${treq2}`, function(data) {
                logger.debug2('** mpv->event.on(event-chapter-change).once(chapter-list); data = "%j"', data);
                var tdata = data.data;

                playstat.chapter_tot = tdata.length;
                playstat.chapter_list = tdata;

                try { playstat.chapter_title = tdata[playstat.chapter].title; }
                catch(e) { playstat.chapter_title = null; }

                event.emit('player-state-updated', playstat);
            });
        });
    });

    event.on('player-state-updated', function(newdata) {
        var dout = _.extend(newdata);
        vstat = _.extend(newdata);
        logger.debug2("** mpv->player-state-updated: newdata = %j", dout);
        if(evt_cbx) {
            evt_cbx({ msgtype: '_ipc_vidstatus', data: dout });
        }
    });

}

function parse_first_data(rawresp) {
    var odata;
    try {
        odata = String(rawresp).trim().split('\n').map(function(x) { return JSON.parse(x); }).filter(function(x) { return typeof x.data != 'undefined'; })[0];
        if(odata) {
            odata = odata.data;
        } else {
            odata = {};
        }
    } catch(e) {
        logger.error("Failed to decode mpv response", e);
        odata = {};
    }

    return odata;
}
