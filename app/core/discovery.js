/**
 ******************************************************************************
 *
 * core/discovery.js
 * mDNS Discovery
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
const dns = require('dns');
const url = require('url');

const C = require('chalk');
const _ = require('lodash');
const ip = require('ip');
var bonjour = require('bonjour')();

const pkgdata = require('../../package');

let services = { main: null, mongo: null, xbake: null };

function advertise(_cbx) {

    isMongoLocal(settings.mongo, function(mongoLocal) {
        // advertise MongoDB instance, if it is running locally
        if(mongoLocal) {
            var mpar = url.parse(settings.mongo);
            var mport = mpar.port ? parseInt(mpar.port) : 27017;
            var mconnstr = `mongodb://${ip.address()}:${mport}${mpar.path}`;
            services.mongo = bonjour.publish({ name: 'tsukimi', type: 'tsukimi-mongo', port: mport, txt: { mconnstr: mconnstr } });
            logger.verbose("Advertising _tsukimi-mongo._tcp:%d", mport);
        }

        // advertise Tsukimi
        var tktxt = {
            version: pkgdata.version,
            platform: os.platform(),
            arch: os.arch()
        };
        services.main = bonjour.publish({ name: 'tsukimi', type: 'tsukimi', port: settings.listen.port, txt: tktxt });
        logger.verbose("Advertising _tsukimi._tcp:%d", settings.listen.port);

        // TODO: advertise XBake
        //services.xbake = bonjour.publish({name: 'xbake', type: 'tsukimi-xbake', port: 0});
        //logger.verbose("Advertising _tsukimi-xbake._tcp:%d", 0);

        _cbx(null);
    });

}

function unpublish(_cbx) {
    bonjour.unpublishAll(_cbx);
}

function findPeers(_cbx) {
    bonjour.find({ type: 'tsukimi', protocol: 'tcp' }, function(tsk_peers) {
        bonjour.find({ type: 'tsukimi-mongo', protocol: 'tcp' }, function(mon_peers) {
            _cbx({ tsukimi: tsk_peers, mongo: mon_peers });
        });
    });
}

function getIpList() {
    var iplist = [];
    var ifs = os.getNetworkInterfaces();

    for(var i in ifs) {
        iplist = iplist.concat(ifs[i].map(function(x) { return x.address }));
    }

    return iplist;
}

function isIpLocal(ip) {
    var iplist = getIpList();
    return _.includes(iplist, ip);
}

function isMongoLocal(mongostr, _cbx) {
    var mpar = url.parse(mongostr);
    dns.lookup(mpar.hostname, function(err, addr, afam) {
        if(err) {
            logger.error("Failed to lookup MongoDB connection hostname:", err);
            _cbx(false);
        } else {
            _cbx(isIpLocal(addr));
        }
    });
}


/** Exports **/

exports.advertise = advertise;
exports.unpublish = unpublish;
exports.findPeers = findPeers;
