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
	monjer.collection('files').find(qparams).toArray(function(err, docs) {
		console.log("query_files: returned "+docs.length+" files");
		_cbx(err, docs);
	});
}

function get_file_groups(_cbx) {
	// group/reduce by tdex_id (series)
	var reducer = function(curr,result) {
					if(curr.series_id) result.series_id = curr.series_id;
					result.count++;
					if(curr.status == "new") result.new++;
					if(curr.status == "complete") result.complete++;
				  };

	// run aggregation
	monjer.collection('files').group({ tdex_id: 1 }, {}, { count: 0, new: 0, complete: 0 }, reducer, function(err,docs) {
		console.log("get_file_groups: returned "+docs.length+" groups");
		console.log("groups:",docs);
		_cbx(err,docs);
	});
}

function get_series_data(_cbx) {
	monjer.collection('series').find({}).toArray(function(err,docs) {
		if(err) console.log("ERROR: Failed to retrieve series data: "+err);

		console.log("get_series_data: returned "+docs.length+" series");

		// build assoc array of series
		var slist = {};
		for(si in docs) {
			var tdoc = docs[si];
			slist[tdoc['_id']] = tdoc;
		}

		_cbx(slist);
	});
}

function update_series(serid, indata, _cbx) {
	monjer.collection('series').update({ _id: serid }, indata, function(err,rdoc) {
		if(err) {
			console.log("Failed to update series data for "+serid);
			_cbx(err);
		} else {
			console.log("Wrote updated series data for "+serid);
			_cbx(null);
		}
	});
}

function add_series_full(sname, indata, _cbx) {
	// clone data
	var sdata = JSON.parse(JSON.stringify(indata));
	delete(sdata.episodes);

	// generate a new norm_id
	var new_tdex = normalize(sdata.ctitle);

	// generate series_id
	var tser_id = mkid_series(new_tdex, sdata);

	// set series data
	var thisx = {
					'_id': tser_id,
					norm_id: new_tdex,
					title: sdata.ctitle,
					count: null,
					genre: sdata.genre,
					xrefs: sdata.xrefs,
					tv: sdata.tv,
					ctitle: sdata.ctitle,
					synopsis: sdata.synopsis,
					lastupdated: sdata.lastupdated,
					artwork: sdata.artwork
				};

	// process episode data
	var eplist = [];
	for(ti in indata.episodes) {
		var thisep = indata.episodes[ti];
		var tep_id = mkid_episode(tser_id, thisep);
		thisep._id = tep_id;
		thisep.tvdb_id = thisep.id;
		thisep.sid = tser_id;
		delete(thisep.id);
		eplist.push(thisep);
	}

	console.log("eplist ready for insert:",eplist);

	// insert series data into Mongo
	monjer.collection('series').insert(thisx, function(err,rec) {
		if(!err) {
			monjer.collection('episodes').insert(eplist, function(err,rec) {
				if(!err) {
					console.log("Inserted series and episode data into Mongo successfully!");
					_cbx({ status: "ok", new_tdex: new_tdex, series_id: tser_id });
				} else {
					console.log("ERROR: failed to insert episodes into Mongo. err:",err);
					_cbx({ status: "error", error: err });
				}
			});
		} else {
			console.log("ERROR: failed to insert series into Mongo. err:",err);
			_cbx({ status: "error", error: err });
		}
	});

}

function mkid_series(sid, xdata) {
	// create unique series ID with tdex_id + release year
	var dyear;
	if(xdata.tv.debut) {
		dyear = String((new Date(parseFloat(xdata.tv.debut) * 1000.0)).getFullYear());
	} else {
		dyear = "90" + String(parseInt(Date.now() / 1000)).substr(-5);
	}
	return sid + "." + dyear
}

function mkid_episode(sid, xdata) {
	var isuf = (xdata.id || String(Date.now() / 1000000.0).split('.')[1])
	return sid + "." + (String(xdata.SeasonNumber) || '0') + "." + (String(xdata.EpisodeNumber) || '0') + "." + isuf;
}

function update_file_series(match, serid, _cbx) {
	// retrieve files for update
	monjer.collection('files').find(match).toArray(function(err,files) {
		console.log("returned files =",files);
		// retrieve episodes for series
		monjer.collection('episodes').find({ sid: serid }).toArray(function(err,eplist) {
			// loop through all of the files and update the series_id and episode_id
			var fcount = eplist.length;
			var newfiles = [];
			for(ti in files) {
				var tfile = files[ti];
				console.log("ti="+ti+", tfile=",tfile);
				tfile.series_id = serid;
				tfile.episode_id = (eplist.filter(function(x) { return (parseInt(x.SeasonNumber) == parseInt(tfile.fparse.season) && parseInt(x.EpisodeNumber) == parseInt(tfile.fparse.episode) ? true : false); })[0]._id || null);
				newfiles.push(tfile);
			}
			// remove existing files; may change this later, but this makes things
			// easier so that we don't need to create a seperate function to do this
			// with a chain of callbacks to update every single entry
			monjer.collection('files').remove(match, function(err,rdoc) {
				if(!err) console.log("removed existing files without error");
				else console.log("ERROR: error removing existing files")

				// update files
				monjer.collection('files').insert(newfiles, function(err,rdoc) {
					if(!err) console.log("inserted updated file entries OK");
					else console.log("ERROR: error when adding new file entries");

					// update series entry with correct count
					monjer.collection('series').update({ '_id': serid }, { '$set': { count: fcount } }, function(err,rdoc) {
						console.log("updated series file count OK");
						_cbx(null);
					});
				});
			});
		});
	});
}

function normalize(instr) {
	return instr.replace(/[ ★☆\.]/g,'_').replace(/['`\-\?!%&\*@\(\)#:,\/\\;\+=\[\]\{\}\$\<\>]/g,'').toLowerCase().trim();
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
exports.add_series_full		= add_series_full;
exports.update_file_series	= update_file_series;
exports.update_series		= update_series;
