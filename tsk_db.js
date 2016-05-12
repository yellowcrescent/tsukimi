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
	monjer.collection('videos').findOne(qparams, _cbx);
}

function get_video_byid(id, _cbx) {
	monjer.collection('videos').findOne({ "_id": String(id) }, _cbx);
}

function query_series(qparams, _cbx) {
	monjer.collection('series').find(qparams).toArray(_cbx);
}

function get_series(qparams, _cbx) {
	monjer.collection('series').findOne(qparams, _cbx);
}

function get_series_byid(id, _cbx) {
	monjer.collection('series').findOne({ "_id": String(id) }, _cbx);
}

function query_episodes(qparams, _cbx) {
	monjer.collection('episodes').find(qparams).toArray(_cbx);
}

function get_episode(qparams, _cbx) {
	monjer.collection('episodes').findOne(qparams, _cbx);
}

function get_episode_byid(id, _cbx) {
	monjer.collection('episodes').findOne({ "_id": String(id) }, _cbx);
}

function query_files(qparams, _cbx) {
	monjer.collection('files').find(qparams).toArray(_cbx);
}

function get_file_groups(_cbx) {
	// group/reduce by tdex_id (series)
	var reducer = function(curr,result) {
					result.series_id = curr.series_id;
					result.count++;
					if(curr.status == "new") result.new++;
					if(curr.status == "complete") result.complete++;
				  };

	// run aggregation
	monjer.collection('files').group({ tdex_id: 1 }, {}, { count: 0, new: 0, complete: 0 }, reducer, function(err,docs) {
		_cbx(err,docs);
	});
}

function get_series_data(_cbx) {
	monjer.collection('series').find({}).toArray(function(err,docs) {
		if(err) console.log("ERROR: Failed to retrieve series data: "+err);

		// build assoc array of series
		var slist = {};
		for(si in docs) {
			var tdoc = docs[si];
			slist[tdoc['_id']] = tdoc;
		}

		_cbx(slist);
	});
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
exports.query_files			= query_files;
exports.get_file_groups		= get_file_groups;
exports.get_series_data		= get_series_data;
