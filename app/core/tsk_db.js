/**
 ******************************************************************************
 **`%vim: set modelines=15:
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
/* jshint -W083 */
/* jshint -W049 */

var MongoClient = require('mongodb').MongoClient;
const _ = require('lodash');
const events = require('events');
const logthis = require('./logthis');
const scanner = require('./scanner');
const utils = require('./utils');
const {Scraper, Scraper_tvdb} = require('./scrapers');

var emitter = new events.EventEmitter();
var monjer = false;

function connect(conx, _cbx) {
	logthis.verbose("Connecting to MongoDB: %s", conx);
	try {
		MongoClient.connect(conx, function(err,db) {
			if(!err) {
				logthis.info("Connected to Mongo OK");
				monjer = db;
				emitter.emit('db_connect_ok');
				_cbx(null);
			} else {
				logthis.error("Failed to connect to Mongo database:", err);
				monjer = false;
				emitter.emit('db_connect_fail');
				_cbx(err);
			}
		});
	} catch(err) {
		logthis.error("Failed to connect to Mongo database:", err);
		_cbx(err);
	}
}

function close() {
	if(monjer) {
		monjer.close();
		logthis.verbose("Connection to Mongo closed");
	} else {
		logthis.debug("Connection to Mongo not active");
	}
	emitter.emit('db_close');
}

function query_videos(qparams, _cbx) {
	monjer.collection('videos').find(qparams).toArray(_cbx);
}

function query_videos_rr(qparams, _cbx) {
	// use of this function versus query_videos() is preferred for
	// filling out templates, since it resolves external references,
	// then joins them inline with the video document
	var qerr = null;
	var qvids = [];
	var qfiles = {};

	var resolveFiles = function(fidlist, fIndex, _cbx) {
		monjer.collection('files').findOne({ _id: fidlist[fIndex].id }, function(err, tf) {
			if(err) {
				logthis.warning("RefResolver: Failed to lookup file %s:", fidlist[fIndex].id, err);
			} else {
				qfiles[fidlist[fIndex].id] = tf;
			}

			fIndex++;
			if(fIndex < fidlist.length) {
				resolveFiles(fidlist, fIndex, _cbx);
			} else {
				_cbx(qfiles);
			}
		});
	};

	var resolveDocument = function(vids, curIndex, _cbx) {
		var tvid = vids[curIndex];

		// series lookup
		monjer.collection('series').findOne({ _id: tvid.series_id }, function(err, tser) {
			if(err) logthis.error("RefResolver: Series lookup for %s failed:", tvid.series_id, err);

			// episode lookup
			monjer.collection('episodes').findOne({ _id: tvid.episode_id }, function(err, tep) {
				if(err) logthis.error("RefResolver: Episode lookup for %s failed:", tvid.episode_id, err);

				// episode image lookup
				monjer.collection('images').findOne({ 'parent.id': tvid.episode_id, 'parent.type': "episode",
													  '$or': [{ 'metadata.default': true }, { 'metadata.selected': true }] },
													  function(err, timg) {
					if(err) logthis.error("RefResolver: Image lookup for %s failed:", tvid.episode_id, err);

					// file lookup
					qfiles = {};
					resolveFiles(tvid.sources, 0, function(tfiles) {
						tvid['_series'] = tser;
						tvid['_episode'] = tep;
						tvid['_files'] = tfiles;
						tvid['_img'] = (timg ? timg: utils.color_bars);
						qvids.push(tvid);

						curIndex++;
						if(curIndex < vids.length) {
							resolveDocument(vids, curIndex, _cbx);
						} else {
							_cbx(qerr, qvids);
						}
					});
				});
			});
		});
	};

	monjer.collection('videos').find(qparams).toArray(function(err, docs) {
		if(docs.length > 0) {
			resolveDocument(docs, 0, _cbx);
		} else {
			_cbx(err, []);
		}
	});
}

function query_series_rr(qparams, _cbx) {
	var slist = [];

	var resolveSeries = function(dlist, curIndex, _cbx) {
		var tgroup = dlist[curIndex];

		// series lookup
		monjer.collection('series').findOne({ _id: tgroup.series_id }, function(err, tser) {
			if(err) logthis.error("RefResolver: Series lookup for %s failed:", tgroup.series_id, err);

			// episode lookup
			monjer.collection('episodes').find({ series_id: tgroup.series_id }).toArray(function(err, eplist) {
				if(err) logthis.error("RefResolver: Episode lookup for %s failed:", tgroup.series_id, err);

				// image lookup
				get_series_images(tser, function(imgs) {
					tser['episodes'] = eplist;
					tser['_groupdata'] = tgroup;
					tser['_imgdata'] = imgs;
					slist.push(tser);

					curIndex++;
					if(curIndex < dlist.length) {
						resolveSeries(dlist, curIndex, _cbx);
					} else {
						_cbx(null, slist);
					}
				});
			});
		});
	};

	get_series_groups(qparams, function(err, docs) {
		if(docs.length > 0) {
			resolveSeries(docs, 0, _cbx);
		} else {
			_cbx(err, []);
		}
	});
}

function get_series_groups(qparams, _cbx) {
	// group/reduce by series_id
	var reducer = function(curr,result) {
					if(curr.series_id) result.series_id = curr.series_id;
					result.count++;
					result.groups = result.groups.concat(curr.groups);
				  };

	// run aggregation
	monjer.collection('videos').group({ series_id: 1 }, qparams, { count: 0, groups: [] }, reducer, function(err, docs) {
		if(err) logthis.error("get_series_groups: Series group aggro failed", qparams, err);

		// consolidate group listings
		for(tgroup in docs) {
			docs[tgroup].groups = _.union(docs[tgroup].groups);
		}

		logthis.debug("get_series_groups: returned %d groups", docs.length, { err: err, docs: docs });
		_cbx(err, docs);
	});
}

function get_series_images(serdata, _cbx, run_count = 0) {
	// retrieves images for the specified series from the database,
	// or downloads them if they are not available locally
	var qdata = {
		'parent.id': serdata._id,
		'parent.type': "series",
		'$or': [
			{ 'metadata.default': true },
			{ 'metadata.selected': true }
		]
	};

	var scraper = new Scraper();

	monjer.collection('images').find(qdata).toArray(function(err, docs) {
		if(err) {
			logthis.error("Failed to fetch series images", err);
			_cbx([]);
		} else if(docs.length == 0 && run_count == 0) {
			logthis.info("Series images not found in database; re-scraping images from source...");
			scraper.fetch_series_images(serdata, function(idata_new) {
				if(idata_new.length) {
					put_image_data(idata_new, function(err) {
						if(err) logthis.error("Failed to save image data", err);
						//xget_series_images(serdata, _cbx, 1);
						_cbx(idata_new);
					});
				} else {
					logthis.error("Failed to fetch series images; retry failed [a]");
					_cbx([]);
				}
			});
		} else if(docs.length == 0 && run_count > 0) {
			logthis.error("Failed to fetch series images; retry failed [b]");
			_cbx([]);
		} else {
			logthis.verbose("Fetched series images for '%s' (count=%d)", serdata._id, docs.length);
			_cbx(docs);
		}
	});
}

function get_series_episode_images(eplist, _cbx, run_count = 0) {
	// retrieves episode images for the specified series from the database,
	// or downloads them if they are not available locally
	var series_id = eplist[0].series_id;
	var qdata = {
		'parent.setref': series_id,
		'parent.type': "episode",
		'$or': [
			{ 'metadata.default': true },
			{ 'metadata.selected': true }
		]
	};

	var scraper = new Scraper();

	monjer.collection('images').find(qdata).toArray(function(err, docs) {
		if(err) {
			logthis.error("Failed to fetch episode images", err);
			_cbx([]);
		} else if(docs.length == 0 && run_count == 0) {
			logthis.info("Episode images not found in database; re-scraping images from source...");
			scraper.fetch_episode_images(eplist, function(idata_new) {
				if(idata_new.length) {
					put_image_data(idata_new, function(err) {
						if(err) logthis.error("Failed to save image data", err);
						_cbx(idata_new);
					});
				} else {
					logthis.error("Failed to fetch episode images; retry failed [a]");
					_cbx([]);
				}
			});
		} else if(docs.length == 0 && run_count > 0) {
			logthis.error("Failed to fetch episode images; retry failed [b]");
			_cbx([]);
		} else {
			logthis.verbose("Fetched episode images for '%s' (count=%d)", series_id, docs.length);
			_cbx(docs);
		}
	});
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
	monjer.collection('episodes').findOne({ _id: id }, function(err, docs) {
		if(err) logthis.error("Failed to retrieve episode data",{ err: err, docs: docs });
		_cbx(docs);
	});
}

function get_episode_data(sid, _cbx) {
	monjer.collection('episodes').find({ series_id: sid }).toArray(function(err,docs) {
		if(err) logthis.error("Failed to retrieve episode data",{ err: err, docs: docs });

		logthis.debug("get_episode_data: returned %d episodes", docs.length);

		// build assoc array of series
		var slist = {};
		for(si in docs) {
			var tdoc = docs[si];
			slist[tdoc['_id']] = tdoc;
		}

		_cbx(slist);
	});
}

function update_episode(epid, indata, _cbx) {
	monjer.collection('episodes').update({ _id: epid }, indata, function(err,rdoc) {
		if(err) {
			logthis.debug("Failed to update episode data for %s", epid);
			_cbx(err);
		} else {
			logthis.debug("Wrote updated episode data for %s", epid);
			_cbx(null);
		}
	});
}

function update_file(id, indata, _cbx) {
	monjer.collection('files').update({ _id: id }, indata, function(err,rdoc) {
		if(err) {
			logthis.debug("Failed to update file data for %s", id);
			_cbx(err);
		} else {
			logthis.debug("Wrote updated file data for %s", id);
			_cbx(null);
		}
	});
}

function remove_file(id, _cbx) {
	monjer.collection('files').remove({ _id: id }, _cbx);
}

function query_files(qparams, _cbx) {
	monjer.collection('files').find(qparams).toArray(function(err, docs) {
		logthis.debug("query_files: returned %d files", docs.length);
		_cbx(err, docs);
	});
}

function get_file_data(id, _cbx) {
	monjer.collection('files').findOne({ _id: id }, function(err, docs) {
		if(err) logthis.error("Failed to retrieve file data",{ err: err, docs: docs });
		_cbx(docs);
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
		logthis.debug("get_file_groups: returned %d groups", docs.length);
		_cbx(err,docs);
	});
}

function get_series_data(_cbx) {
	monjer.collection('series').find({}).toArray(function(err,docs) {
		if(err) logthis.error("Failed to retrieve series data",{ err: err, docs: docs });

		logthis.debug("get_series_data: returned %d series", docs.length);

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
			logthis.debug("Failed to update series data for %s", serid);
			_cbx(err);
		} else {
			logthis.debug("Wrote updated series data for %s", serid);
			_cbx(null);
		}
	});
}

function add_series_full(sname, indata, _cbx) {
	// clone data
	var sdata = JSON.parse(JSON.stringify(indata));
	delete(sdata.episodes);

	// generate a new norm_id
	var new_tdex = Scraper.normalize(sdata.ctitle);

	// set series data
	sdata.norm_id = new_tdex;
	sdata.title = sdata.ctitle;
	sdata.count = null;

	// process episode data
	var eplist = indata.episodes;
	logthis.debug("eplist ready for insert", { eplist: eplist });

	// insert series data into Mongo
	monjer.collection('series').update({ _id: sdata._id }, sdata, { upsert: true }, function(err,cnt,rec) {
		if(!err) {
			var bulk = monjer.collection('episodes').initializeUnorderedBulkOp();

			for(var tdex in eplist) {
				bulk.find({ _id: eplist[tdex]._id }).upsert().replaceOne(eplist[tdex]);
			}

			bulk.execute(function(err, rdoc) {
				if(!err) {
					var xresp = { status: "ok", new_tdex: new_tdex, series_id: sdata._id };
					logthis.verbose("Inserted series and episode data into Mongo successfully", xresp);
					_cbx(xresp);
				} else {
					logthis.error("Failed to insert episodes into Mongo", { error: err, result: rec });
					_cbx({ status: "error", error: err });
				}
			});
		} else {
			logthis.error("Failed to insert series into Mongo", { error: err, result: rec });
			_cbx({ status: "error", error: err });
		}
	});

}

function update_file_series(match, serid, _cbx) {
	// retrieve files for update
	monjer.collection('files').find(match).toArray(function(err, files) {
		logthis.debug("returned files", { err: err, files: files });
		// retrieve episodes for series
		monjer.collection('episodes').find({ series_id: serid }).toArray(function(err, eplist) {
			// loop through all of the files and update the series_id and episode_id
			var fcount = eplist.length;
			var newfiles = [];
			for(ti in files) {
				var tfile = files[ti];
				tfile.series_id = serid;
				try {
					tfile.episode_id = (eplist.filter(function(x) { return parseInt(x.season) == parseInt(tfile.fparse.season) && parseInt(x.episode) == parseInt(tfile.fparse.episode); })[0]._id || null);
				} catch(e) {
					logthis.warning(e.message);
					logthis.error("Skipping file without episode match", tfile);
					continue;
				}
				newfiles.push(tfile);
			}
			// remove existing files; may change this later, but this makes things
			// easier so that we don't need to create a seperate function to do this
			// with a chain of callbacks to update every single entry
			if(newfiles.length > 0) {
				monjer.collection('files').remove(match, function(err,rdoc) {
					if(!err) logthis.verbose("removed existing files without error");
					else logthis.error("Error removing existing files", { error: err, result: rdoc});

					// update files
					monjer.collection('files').insert(newfiles, function(err,rdoc) {
						if(!err) logthis.verbose("inserted updated file entries OK");
						else logthis.error("Error when adding new file entries", { error: err, result: rdoc});

						// update series entry with correct count
						monjer.collection('series').update({ '_id': serid }, { '$set': { count: fcount } }, function(err,rdoc) {
							logthis.verbose("updated series file count OK");
							_cbx(null);
						});
					});
				});
			} else {
				logthis.error("No files updated");
				_cbx('no_matching_files');
			}
		});
	});
}

function import_selection(selection, iconfig, cbProgress, _cbx) {
	var numSelection = selection.length;
	var err = null;

	var doScreenshot = function(fdata, _cbx) {
		if(iconfig.vscap_auto) {
			try {
				scanner.xbake_vscap(fdata.location[fdata.default_location].fpath.real, fdata._id, 'auto', _cbx);
			} catch(e) {
				logthis.exception("Failed to construct XBake call due to malformed or incomplete file object:", e);
				_cbx(null);
			}
		} else {
			_cbx(null);
		}
	};

	var scraper = new Scraper();

	var vidImport = function(slist, curIndex, _cbx) {
		// retrieve file object, fresh from the db
		monjer.collection('files').findOne({ _id: slist[curIndex]._id }, function(err, tfile) {
			// grab series and episode entries
			monjer.collection('series').findOne({ _id: tfile.series_id }, function(err, tser) {
				monjer.collection('episodes').findOne({ _id: tfile.episode_id }, function(err, tep) {
					console.log("tfile =", tfile);
					console.log("tser =", tser);
					console.log("tep =", tep);

					// generate video ID & update progress
					tvid_id = Scraper.mkid_video(tser, tep);
					cbProgress(tvid_id);

					// check if video already exists
					monjer.collection('videos').findOne({ _id: tvid_id }, function(err, xvdata) {
						var vdata;
						var itime = parseInt(Date.now() / 1000);
						if(xvdata) {
							logthis.debug("Updating existing entry for %s:", tvid_id, xvdata);
							vdata = xvdata;
						} else {
							logthis.debug("Creating new entry for %s", tvid_id);
							vdata = {
								_id: tvid_id,
								metadata: {
									title: null,
									series: null,
									episode: null,
									season: null,
									special: tfile.fparse.special || null
								},
								series_id: tser._id,
								episode_id: tep._id,
								vstats: {
									ctime: itime,
									mtime: itime,
									last_watched: null,
									view_count: 0
								},
								vscap: [],
								sources: [],
								groups: [],
								tags: [],
								status: 'ok'
							};
						}

						// remove default bit from any existing sources; new entry will be set as default
						// may want to have this be a configuration option
						for(tvsi in vdata.sources) {
							vdata.sources[tvsi].default = false;
						}

						if(iconfig.group) {
							vdata.groups.push(iconfig.group);
						}

						vdata.vstats.mtime = itime;
						vdata.sources.push({
							id: tfile._id,
							default: true,
							default_location: tfile.default_location || null,
							mediainfo: tfile.mediainfo
						});

						// take screenshot, if enabled; otherwise returns null
						doScreenshot(tfile, function(vscap) {
							if(vscap) {
								logthis.debug("Took screenshot successfully:", vscap);
								vdata.vscap = vscap;
							}

							// fetch episode images
							scraper.fetch_episode_images([tep], function(timglist) {
								var timg = null;
								if(timglist.length) {
									logthis.debug("Fetched episode image OK");
									timg = timglist[0];
								}

								// upsert episode image into database
								monjer.collection('images').update({_id: (timg ? timg._id : null)}, timg, {upsert: true}, function(err, rdoc) {
									if(err && timg) logthis.error("Failed to upsert episode image entry for %s", timg._id, err);

									// upsert into videos collection
									monjer.collection('videos').update({_id: tvid_id}, vdata, {upsert: true}, function(err, rdoc) {
										if(err) logthis.error("Failed to upsert video entry for %s", tvid_id, err);

										// update file status
										tfile.status = "complete";
										monjer.collection('files').update({_id: tfile._id}, tfile, function(err, rdoc) {
											if(err) logthis.error("Failed to update file status for %s", tfile._id, err);

											// on to the next one
											curIndex++;
											if(curIndex < numSelection) {
												vidImport(slist, curIndex, _cbx);
											} else {
												_cbx(err);
											}
										});
									});
								});
							});
						});
					});
				});
			});
		});
	};

	vidImport(selection, 0, _cbx);
}

function sync_series_image_metadata(serdata, _cbx) {

	monjer.collection('images').find({ 'parent.id': serdata._id, 'parent.type': 'series' }).toArray(function(err, idata) {
		if(err) {
			logthis.error("Failed to fetch images for series '%s'", serdata._id, err);
			_cbx(err);
		}

		var bulk = monjer.collection('images').initializeUnorderedBulkOp();

		for(var tdex in idata) {
			try {
				var tart = serdata.artwork[idata[tdex].imgtype].filter(function(x) { return `${x.source}_${x.id}` == idata[tdex]._id; })[0];
			} catch(e) {
				logthis.debug("sync_series_image_metadata: no matching artwork found for image '%s'", idata[tdex]._id);
				continue;
			}

			idata[tdex].metadata = tart;
			bulk.find({ _id: idata[tdex]._id }).upsert().replaceOne(idata[tdex]);
		}

		bulk.execute(function(err, rdoc) {
			if(err) logthis.error("Bulk metadata update for '%s' series images failed", serdata._id, err);
			_cbx(err);
		});
	});

}

function put_image_data(idata, _cbx) {
	var bulk = monjer.collection('images').initializeUnorderedBulkOp();

	for(var tdex in idata) {
		bulk.find({ _id: idata[tdex]._id }).upsert().replaceOne(idata[tdex]);
	}

	bulk.execute(function(err, rdoc) {
		if(!err) logthis.verbose("Inserted images OK");
		else logthis.error("Error when adding new image entries", { error: err, result: rdoc});
		_cbx(err);
	});
}

function get_image_data(id, _cbx) {
	monjer.collection('images').findOne({ _id: id }, function(err, docs) {
		if(err) logthis.error("Failed to retrieve image data for '%s'", id, { err: err, docs: docs });
		_cbx(docs);
	});
}

function get_images(qparams, _cbx) {
	monjer.collection('images').find(qparams).toArray(_cbx);
}


/**
 * Exports
 **/

exports.connect				= connect;
exports.close				= close;
exports.query_videos		= query_videos;
exports.query_videos_rr		= query_videos_rr;
exports.query_series_rr		= query_series_rr;
exports.get_series_groups	= get_series_groups;
exports.get_video			= get_video;
exports.get_video_byid		= get_video_byid;
exports.query_series		= query_series;
exports.get_series			= get_series;
exports.get_series_byid		= get_series_byid;
exports.query_episodes		= query_episodes;
exports.get_episode			= get_episode;
exports.get_episode_byid	= get_episode_byid;
exports.get_episode_data	= get_episode_data;
exports.update_episode		= update_episode;
exports.update_file			= update_file;
exports.remove_file			= remove_file;
exports.query_files			= query_files;
exports.get_file_groups		= get_file_groups;
exports.get_series_data		= get_series_data;
exports.add_series_full		= add_series_full;
exports.update_file_series	= update_file_series;
exports.update_series		= update_series;
exports.get_file_data		= get_file_data;
exports.import_selection	= import_selection;
exports.put_image_data		= put_image_data;
exports.get_image_data		= get_image_data;
exports.get_images			= get_images;
exports.sync_series_image_metadata = sync_series_image_metadata;
exports.get_series_images   = get_series_images;
