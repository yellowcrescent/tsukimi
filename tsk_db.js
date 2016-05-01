/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * tsk_db.js
 * Database interfaces
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var MongoClient = require('mongodb').MongoClient;
var events = require('events');

var emitter = new events.EventEmitter();
var monjer = false;

function connect(conx) {
	console.log("Connecting to MongoDB: "+conx);
	MongoClient.connect(conx, function(err,db) {
		if(!err) {
			console.log("Connected to Mongo OK");
			monjer = db;
			emitter.emit('db_connect_ok');
		} else {
			console.log("Failed to connect to Mongo database");
			monjer = false;
			emitter.emit('db_connect_fail');
		}
	});
}

function close() {
	if(monjer) {
		monjer.close();
		console.log("Connection to Mongo closed");
	} else {
		console.log("Connection to Mongo not active");
	}
	emitter.emit('db_close');
}

function query_videos(qparams, _cbx) {
	monjer.collection('videos').find(qparams).toArray(_cbx);
}

function get_video(qparams, _cbx) {
	monjer.colleciton('videos').findOne(qparams, _cbx);
}

function get_video_byid(id, _cbx) {
	monjer.colleciton('videos').findOne({ "_id": String(id) }, _cbx);
}

function query_series(qparams, _cbx) {
	monjer.collection('series').find(qparams).toArray(_cbx);
}

function get_series(qparams, _cbx) {
	monjer.colleciton('series').findOne(qparams, _cbx);
}

function get_series_byid(id, _cbx) {
	monjer.colleciton('series').findOne({ "_id": String(id) }, _cbx);
}

function query_episodes(qparams, _cbx) {
	monjer.collection('episodes').find(qparams).toArray(_cbx);
}

function get_episode(qparams, _cbx) {
	monjer.colleciton('episodes').findOne(qparams, _cbx);
}

function get_episode_byid(id, _cbx) {
	monjer.colleciton('episodes').findOne({ "_id": String(id) }, _cbx);
}

/**
 * Exports
 **/

exports.connect				= connect;
exports.close				= close;
exports.query_videos		= query_videos;
exports.get_video			= get_video;
exports.get_video_byid		= get_video_byid;
exports.query_series		= query_series;
exports.get_series			= get_series;
exports.get_series_byid		= get_series_byid;
exports.query_episodes		= query_episodes;
exports.get_episode			= get_episode;
exports.get_episode_byid	= get_episode_byid;
