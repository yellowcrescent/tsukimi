/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * public/controllers/library.js
 * Controllers: Library
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

function libraryController($scope, $location, $routeParams, $http, $filter, $modal, $alert) {
	logthis.debug("libraryController start");

	$scope.flist = [];
	$scope.selection = [];
	$scope.hasFocus = null;
	$scope.selected = null;
	$scope.modeToggle = false;
	$scope.modal = { '$isShown': false };
	$scope.scanStatus = { title: "", content: "", iconClassList: [] };
	var paneList = ['sidebar', 'rport', 'modal', 'ssmodal'];
	var orderBy = $filter('orderBy');

	$scope.reorder = function(pred) {
		$scope.flist = orderBy($scope.flist, pred, false);
	};

	// event listener for keyboard stuff
	document.body.addEventListener('keydown', _lib_event_keydown);

	// event listeners for context menu
	document.getElementById('flist-tab').addEventListener('contextmenu', _lib_rview_contextmenu);
	document.getElementById('lib-tree').addEventListener('contextmenu', _lib_tree_contextmenu);

	$scope.flist_select = function($event, fid) {
		var bSelected = $('#file-'+fid).prop('checked');
		var tindex = $('.fentry').index($('#row-'+fid));

		if($event.shiftKey) {
			// multi-select (shift-select)
			var iFirst, iLast;
			if($scope.selected.tindex > tindex) {
				iFirst = tindex;
				iLast = $scope.selected.tindex;
			} else {
				iFirst = $scope.selected.tindex;
				iLast = tindex;
			}

			for(var i = iFirst; i <= iLast; i++) {
				var iid = $('.fentry')[i].id.split('-')[1];
				$('#row-'+iid).addClass('selected');
				$('#file-'+iid).prop('checked', true);
			}

			$scope.selected = { id: fid, tindex: tindex, multi: true };
		} else {
			if($scope.modeToggle) {
				// toggle single
				if(bSelected) {
					// deselect
					$('#row-'+fid).removeClass('selected');
					$('#file-'+fid).prop('checked', false);
				} else {
					// select
					$('#row-'+fid).addClass('selected');
					$('#file-'+fid).prop('checked', true);
					$scope.selected = { id: fid, tindex: tindex, multi: false };
				}
			} else {
				// select single
				if($event.ctrlKey || $event.metaKey) {
					if(bSelected) {
						// ctrl-click deselect
						$('#row-'+fid).removeClass('selected');
						$('#file-'+fid).prop('checked', false);
					} else {
						// ctrl-click select
						$('#row-'+fid).addClass('selected');
						$('#file-'+fid).prop('checked', true);
					}
				} else {
					// click select (normal)
					$('.selected').removeClass('selected');
					$('#row-'+fid).addClass('selected');
					$('#file-'+fid).prop('checked', true);
				}
				$scope.selected = { id: fid, tindex: tindex, multi: false };
			}
		}

		// update the 'select all' checkbox
		var tot = $('.fentry').length;
		var totSelected = $('.fentry.selected').length;
		if(totSelected === 0) {
			$('#file-all').prop('checked', false);
			$('#file-all').prop('indeterminate', false);
		} else if(totSelected == tot) {
			$('#file-all').prop('checked', true);
			$('#file-all').prop('indeterminate', false);
		} else {
			$('#file-all').prop('checked', false);
			$('#file-all').prop('indeterminate', true);
		}
	};

	$scope.flist_toggle_all = function($event) {
		// get checkbox state and list size
		var bChecked = $('#file-all').prop('checked');
		var lsize = $('.fentry').length;

		for(var i = 0; i < lsize; i++) {
			var iid = $('.fentry')[i].id.split('-')[1];
			if(bChecked) {
				$('#row-'+iid).addClass('selected');
				$('#file-'+iid).prop('checked', true);
			} else {
				$('#row-'+iid).removeClass('selected');
				$('#file-'+iid).prop('checked', false);
			}
		}
	};

	$scope.setFocus = function(elem) {
		// remove focus from all pane elements
		for(fi in paneList) $('#'+paneList[fi]).removeClass('focused');

		// focus new pane
		$scope.hasFocus = elem;
		$('#'+elem).addClass('focused');
	};

	$scope.ignoreSelected = function() {
		$scope.hasFocus = 'modal';

		// show modal
		$scope.modal = $modal({ title: "Confirm Ignore", templateUrl: "/public/views/partials/modal_ignore_confirm.html", scope: $scope });

		// callback
		$scope.modal.confirm = function() {
			var slist;

			// if nothing is selected, we've chosen 'Ignore All'
			if($('.fentry.selected').length === 0) {
				slist = $('.fentry');
			} else {
				slist = $('.fentry.selected');
			}

			// get list of IDs
			var ilist = _lib_get_flist_selection(slist, $scope.flist);

			var removalFunc = function(next, _cbx) {
				var tff = ilist[next];
				var tfpath = tff.location[tff.default_location].fpath.real;
				// set user.xbake.ignore xattrib so the file is ignored in future scans
				tkcore.fsutils.xattr_set_ignore(tfpath, function(xerr) {
					// remove file from db.files collection
					tkcore.db.remove_file(tff._id, function(xerr) {
						logthis.verbose("Set ignore xattrib and removed file from database: %s", tff._id);
						if(next < (ilist.length - 1)) {
							removalFunc(next+1, _cbx);
						} else {
							_cbx();
						}
					});
				});
			};

			removalFunc(0, function() {
				$scope.modal.hide();
				$scope.refresh();
				logthis.debug("Finished ignoring files");
			});
		};

	};

	$scope.deleteSelected = function () {
		$scope.hasFocus = 'modal';

		// build modal confirmation dialog
		$scope.modal = $modal({ title: "Confirm Delete", templateUrl: "/public/views/partials/modal_basic.html", scope: $scope, content: "Delete file(s) from disk and remove corresponding database entries? <br/><b>This cannot be undone</b>" });
		$scope.modal.confirmText = "Delete";
		$scope.modal.confirmClass = "btn-danger";
		$scope.modal.contentIcon = "fa-warning";

		// callback
		$scope.modal.confirm = function() {
			var slist = $('.fentry.selected');
			logthis.debug("slist: %j", slist, {});
			for(var ti = 0; ti < slist.length; ti++) {
				logthis.debug("delete: %j", slist[ti], {});
			}
			$scope.modal.hide();
		};

	};

	$scope.filePropDiag = function() {
		$scope.hasFocus = 'modal';
		var ilist = _lib_get_flist_selection($('.fentry.selected'), $scope.flist);
		var iid = ilist[0]._id;
		logthis.debug2("filePropDiag; id = %s", iid);

		tkcore.db.get_series_data(function(slist) {
			tkcore.db.get_file_data(iid, function(fdata) {
				tkcore.db.get_episode_data(fdata.series_id, function(epdata) {
					// build property data
					$scope.sprop = fdata;
					$scope.epdata = epdata;
					$scope.serdata = slist;
					$scope.sprop.serdata = $scope.sprop.seriesSelected = $scope.serdata[$scope.sprop.series_id];
					$scope.sprop.epdata = $scope.sprop.episodeSelected = $scope.epdata[$scope.sprop.episode_id];

					// build modal properties dialog
					$scope.modal = $modal({ title: iid, templateUrl: "/public/views/partials/modal_prop_file.html", scope: $scope });

					$scope.modal.confirm = function() {
						var pfails = [];

						// copy and sterilize object
						var nprop = _copy($scope.sprop);
						delete nprop.seriesSelected;
						delete nprop.episodeSelected;
						delete nprop.serdata;
						delete nprop.epdata;

						// update fparse values according to selected episode
						if($scope.sprop.epdata) {
							nprop.fparse.series = $scope.sprop.serdata.title;
							nprop.fparse.season = $scope.sprop.epdata.season;
							nprop.fparse.episode = $scope.sprop.epdata.episode;
						}

						// update file data
						logthis.debug2("commiting new file data", nprop);
						tkcore.db.update_file(nprop._id, nprop, function(err) {
							if(err) {
								logthis.error("Failed to commit changes for file %s: %s", nprop._id, err);
								pfails.push("Failed to save file changes: "+err);
							}
							// update episode data
							logthis.debug2("commiting new episode data", $scope.epdata);
							tkcore.db.update_episode($scope.sprop.epdata._id, $scope.sprop.epdata, function(err) {
								if(err) {
									logthis.error("Failed to commit changes for series %s: %s", nprop._id, err);
									pfails.push("Failed to save series changes: "+err);
								}
								if(pfails.length > 0) {
									$scope.scanStatus = { title: "Database Update", content: pfails[0], iconClassList: ['fa','fa-times'], show: true };
								} else {
									$scope.scanStatus = { title: "Database Update", content: "OK", iconClassList: ['fa','fa-check'], show: true };
								}
								$scope.modal.hide();
								$scope.refresh();
							});
						});
					};

					// set up 'series_id' change callback
					$scope.modal.seriesChange = function() {
						logthis.debug2("seriesChange; series_id = %s",$scope.sprop.seriesSelected._id);
						if($scope.sprop.seriesSelected !== null) {
							$scope.sprop.series_id = $scope.sprop.seriesSelected._id;
							$scope.sprop.serdata = $scope.serdata[$scope.sprop.series_id];
							tkcore.db.get_episode_data($scope.sprop.series_id , function(epdata) {
								$scope.epdata = epdata;
								$scope.sprop.episode_id = null;
								$scope.sprop.episodeSelected = { _id: null };
								$scope.sprop.epdata = null;
								_lib_scopeApply($scope);
							});
						} else {
							$scope.sprop.series_id = null;
							$scope.sprop.serdata = null;
						}
					};

					// set up 'episode_id' change callback
					$scope.modal.episodeChange = function() {
						logthis.debug2("episodeChange; episode_id = %s",$scope.sprop.episodeSelected._id);
						if($scope.sprop.episodeSelected !== null) {
							$scope.sprop.episode_id = $scope.sprop.episodeSelected._id;
							$scope.sprop.epdata = $scope.epdata[$scope.sprop.episode_id];
						} else {
							$scope.sprop.episode_id = null;
							$scope.sprop.epdata = null;
						}
					};

					_lib_scopeApply($scope);
				});
			});
		});

	};

	$scope.seriesPropDiag = function() {
		$scope.hasFocus = 'modal';
		var ccf = $('#lib-tree').jstree(true).get_selected(true)[0].original;
		var iid = ccf.id;
		logthis.debug2("seriesPropDiag; id = %s", iid);

		tkcore.db.get_series_data(function(slist) {
			// build property data
			$scope.sprop = { tdex_id: ccf.id, orig_series: ccf.series_id, series_id: ccf.series_id, serdata: slist[ccf.series_id], seriesSelected: slist[ccf.series_id] };
			$scope.serdata = slist;
			logthis.debug2("seriesPropDiag modal data", $scope.sprop);

			// build modal properties dialog
			$scope.modal = $modal({ title: iid, templateUrl: "/public/views/partials/modal_prop_series.html", scope: $scope });

			// set up 'save' callback
			$scope.modal.confirm = function() {
				// update series data from serdata
				if($scope.sprop.serdata && $scope.sprop.series_id) {
					tkcore.db.update_series($scope.sprop.series_id, $scope.sprop.serdata, function(err) {
						// update series/episode mapping if series has changed
						if($scope.sprop.orig_series != $scope.sprop.series_id) {
							tkcore.db.update_file_series({ tdex_id: ccf.id }, $scope.sprop.series_id, function(err) {
								$scope.modal.finish();
							});
						} else {
							$scope.modal.finish();
						}
					});
				}
			};

			$scope.modal.finish = function() {
				$scope.modal.hide();
				$scope.refresh();
			};

			// set up 'series_id' change callback
			$scope.modal.seriesChange = function() {
				if($scope.sprop.seriesSelected !== null) {
					$scope.sprop.series_id = $scope.sprop.seriesSelected._id;
					$scope.sprop.serdata = $scope.serdata[$scope.sprop.series_id];
				} else {
					$scope.sprop.series_id = null;
					$scope.sprop.serdata = null;
				}
			};

			$scope.modal.doSearch = function(sterm) {
				// setup completion callback to update properties modal
				$scope.seriesSearch(sterm, function(result) {
					// grab updated series data
					tkcore.db.get_series_data(function(slist) {
						$scope.serdata = slist;
						if(result) {
							$scope.sprop.seriesSelected = $scope.serdata[result];
							$scope.modal.seriesChange();
							_lib_scopeApply($scope);
						}
					});
					$scope.hasFocus = 'modal';
				});
			};

			_lib_scopeApply($scope);
		});
	};

	$scope.seriesSearch = function(tdexId, _cbx) {
		if(typeof tdexId == 'undefined') tdexId = null;
		if(typeof _cbx == 'undefined') _cbx = null;

		$scope.hasFocus = 'ssmodal';

		// initialize sersearch obj
		$scope.sersearch = { qterm: null, tvsel: null };
		if(tdexId) {
			$scope.sersearch.qterm = tdexId.replace(/_/g, ' ');
		}

		// build modal properties dialog
		$scope.ssmodal = $modal({ title: "Add Series: Search", templateUrl: "/public/views/partials/modal_addseries.html", scope: $scope });
		$scope.ssmodal.inputIsValid = false;
		$scope.ssmodal.results = [];

		// set up 'save' callback
		$scope.ssmodal.confirm = function(selected) {
			logthis.debug("seriesSearch: selected tvdb id = %s", selected);
			if(selected) {
				// create progress modal
				$scope.modalWait = $modal({ title: "Retrieving Series Information...", templateUrl: "/public/views/partials/modal_wait.html", scope: $scope, content: "Retrieving data from TheTVDb" });
				$scope.modalWait.contentIcon = "fa-cog fa-spin";

				tkcore.scrapers.tvdb_get_series(selected, function(newdata) {
					if(newdata.status == "ok") {
						// update modal text
						$scope.modalWait.content = "Updating database";
						_lib_scopeApply($scope);
						// add series and episodes to database
						tkcore.db.add_series_full(tdexId, newdata.result, function(addrez) {
							if(addrez.status == "ok") {
								logthis.verbose("Series added to database OK; tdex_id=%s / series_id=%s", addrez.new_tdex, addrez.series_id);
								$scope.modalWait.hide();
								$scope.ssmodal.hide();
								if(_cbx) _cbx(addrez.series_id);
							}
						});
					} else {
						logthis.error("Failed to retrieve series data", newdata);
						if(_cbx) _cbx(null);
					}
				});
			} else {
				if(_cbx) _cbx(null);
			}
		};

		// search callback
		$scope.ssmodal.search = function(sterm) {
			if(sterm.trim().length > 1) {
				// disable search button and spin up the spinner
				$('#as_sericon').removeClass('fa-search');
				$('#as_sericon').addClass('fa-refresh fa-spin');
				$('#as_serbtn').prop('disabled', true);
				tkcore.scrapers.tvdb_search(sterm.trim(), function(res) {
					// enable search button again
					$('#as_sericon').removeClass('fa-refresh fa-spin');
					$('#as_sericon').addClass('fa-search');
					$('#as_serbtn').prop('disabled', false);
					logthis.debug("got tvdb response", res);
					var tsdata = $.map($scope.serdata, function(x) { return x; });
					for(ts in res.results) {
						var frez = tsdata.filter(function(x) { return x.xrefs.tvdb == res.results[ts].id; });
						if(frez.length > 0) {
							res.results[ts].exists = true;
						} else {
							res.results[ts].exists = false;
						}
					}
					$scope.ssmodal.results = res.results;
					_lib_scopeApply($scope);
				});
			}
		};

		// keydown callback
		$scope.ssmodal.keydown = function(evt) {
			logthis.debug("ssmodal keydown called; evt.code = %s; as_sersearch focus'd = %s",evt.code, $('#as_sersearch').is(':focus'));
			if($('#as_sersearch').is(':focus')) {
				if(evt.code == 'Enter' || evt.code == 'NumpadEnter') {
					$scope.ssmodal.search($scope.sersearch.qterm);
					evt.preventDefault();
					return false;
				}
			} else {
				if(evt.code == 'Enter' || evt.code == 'NumpadEnter') {
					if($scope.sersearch.tvsel) {
						$scope.ssmodal.confirm($scope.sersearch.tvsel);
					}
					evt.preventDefault();
					return false;
				}
			}
		};

		$scope.ssmodal.inputChange = function(selected) {
			$scope.ssmodal.inputIsValid = true;
			$('.tsk-tser-row').removeClass('info');
			$('#row_'+selected).addClass('info');
		};

	};

	$scope.openLocal = function() {
		// launch 'open folder' dialog and create callback
		_lib_openDirDialog(function(sdir) {
			logthis.verbose("Scanning directory: %s", sdir);
			$scope.scanStatus = { title: "Scanning", content: "Scanning directory: "+sdir, iconClassList: ['fa','fa-spin','fa-moon-o'], show: true };
			tkcore.scanner.xbake_scandir(sdir, function(sdata) {
				switch(sdata.msgtype) {
					case '_exception':
						logthis.error("XBake: Exception: %s", sdata.msg, sdata);
						$scope.scanStatus.title = "Error";
						$scope.scanStatus.content = "XBake Exception: "+sdata.msg;
						$scope.scanStatus.type = 'danger';
						break;
					case '_close':
						logthis.verbose("XBake exited -- retval = %d", sdata.exitcode);
						if(sdata.exitcode > 0) {
							$scope.scanStatus.title = "Scan failed";
							$scope.scanStatus.content = "XBake exited with code " + sdata.exitcode;
							$scope.scanStatus.iconClassList = ['fa','fa-exclamation-triangle'];
							$scope.refresh();
						}
						break;
					case 'complete':
						logthis.info("XBake scan complete -- files: %d / series: %d", sdata.files, sdata.series);
						$scope.scanStatus.title = "Scan complete";
						$scope.scanStatus.content = "Scanned: "+sdata.files+" files / "+sdata.series+" series";
						$scope.scanStatus.iconClassList = ['fa','fa-check-circle-o'];
						$scope.refresh();
						break;
					case 'scanfile':
						logthis.info("Scanning file: %s", sdata.filename);
						$scope.scanStatus.title = "Scanning";
						$scope.scanStatus.content = sdata.filename;
						break;
					case 'series_scrape':
						logthis.info("Scraping: %s (%s)", sdata.tdex_id, sdata.tdex_data.title);
						$scope.scanStatus.title = "Scraping";
						$scope.scanStatus.content = sdata.tdex_id+" ("+sdata.tdex_data.title+")";
						break;
					default:
						logthis.debug("[xbake status] %s: %j", sdata.msgtype, sdata, {});
						break;
				}
				_lib_scopeApply($scope);
			});
		});
	};

	$scope.addToSelection = function(infiles) {
		if(typeof infiles == 'undefined') infiles = null;

		// if flist was not passed in, use files selected by cursor
		var flist;
		if(infiles === null) {
			flist = _lib_get_flist_selection($('.fentry.selected'), $scope.flist);
		} else {
			flist = infiles;
		}

		for(tf in flist) {
			// ensure file doesn't already exist in selection
			if($scope.selection.filter(function(x) { return x._id == flist[tf]._id; }).length === 0) {
				$scope.selection.push(flist[tf]);
				logthis.debug("Added file to working selection: %s", flist[tf]._id);
			}
		}
		$scope.refresh();
	};

	$scope.selectAll = function() {
		$('.fentry').addClass('selected');
		logthis.debug("selectAll - %d entries selected", $('.fentry').length);
	};

	$scope.refresh = function() {
		// make spinny thing spin
		$('#btn-refresh').addClass("fa-spin");

		// get series data
		tkcore.db.get_series_data(function(sers) {

			// get tdex group data
			tkcore.db.get_file_groups(function(err, rez) {
				if(err) {
					logthis.error("Failed to retrieve file group listing", { error: err, result: rez });
					$('#btn-refresh').removeClass("fa-spin");
					return;
				}

				// calculate selections
				for(ti in rez) {
					rez[ti].importPending = $scope.selection.filter(function(x) { return x.tdex_id == rez[ti].tdex_id; }).length;
				}

				// build tree
				_lib_build_tree(rez, sers);

				// set up event callbacks
				$('#lib-tree').on('select_node.jstree', function(e,obj) {
					_lib_populate_rview(obj.node.original, $scope);
				});

				// stop spinnin
				$('#btn-refresh').removeClass("fa-spin");
			});
		});

		//_lib_scopeApply($scope);
	};

	$scope.runImportDiag = function() {
		$scope.hasFocus = 'modal';
		logthis.debug2("runImportDiag");
		$scope.sprop = { group: null, vscap_auto: true, group_list: tskGroupList };

		// build modal properties dialog
		$scope.modal = $modal({ title: "Import Configuration", templateUrl: "/public/views/partials/modal_import.html", scope: $scope });

		$scope.modal.confirm = function() {
			var idata = { group: $scope.sprop.group, vscap_auto: $scope.sprop.vscap_auto };
			$scope.modal.finish();
			$scope.runImport(idata);
		};

		$scope.modal.finish = function() {
			$scope.modal.hide();
			$scope.refresh();
		};

		_lib_scopeApply($scope);
	};

	$scope.runImport = function(import_config) {
		var importProgressCbx = function(msg) {
			$scope.scanStatus.content = msg;
			_lib_scopeApply($scope);
		};

		$scope.scanStatus = { title: "Import", content: "Import in progress...", iconClassList: ['fa','fa-spin','fa-moon-o'], show: true };
		logthis.info("Starting import - %d files", $scope.selection.length);
		logthis.debug("Selected entries:", $scope.selection);
		tkcore.db.import_selection($scope.selection, import_config, importProgressCbx, function(err) {
			if(err) {
				$scope.scanStatus.title = "Import failed";
				$scope.scanStatus.content = err;
				$scope.scanStatus.iconClassList = ['fa','fa-exclamation-triangle'];
				logthis.error("Import failed: %s", err);
			} else {
				$scope.scanStatus.title = "Import complete";
				$scope.scanStatus.content = "Imported " + $scope.selection.length + " files OK";
				$scope.scanStatus.iconClassList = ['fa','fa-check-circle-o'];
				logthis.info("Import completed successfully");
			}
			$scope.selection = [];
			$scope.refresh();
		});
		_lib_scopeApply($scope);
	};

	// perform initial update
	$scope.refresh();

	window.$scope = $scope;
}

function _lib_build_tree(indata, sdata) {
	var ygg = [];
	for(ti in indata) {
		var tg = indata[ti];
		var tsd = sdata[tg.series_id];
		var ticon;

		// map icon to entry
		if(tg.complete == tg.count) ticon = 'fa-circle ricon-blue';
		else if(tg.series_id === null) ticon = 'fa-exclamation-triangle ricon-red';
		else if(tg.importPending == tg.count) ticon = 'fa-check-circle-o ricon-green';
		else if(tg.importPending > 0 && tg.importPending < tg.count) ticon = 'fa-bullseye ricon-green';
		else if(tg.new == tg.count) ticon = 'fa-circle-o ricon-default';
		else ticon = 'fa-circle-o ricon-red';

		var tnode = {
						id: tg.tdex_id,
						series_id: tg.series_id,
						text: (tsd ? tsd.title : tg.tdex_id),
						icon: "fa " + ticon
					};
		ygg.push(tnode);
	}

	if($('#lib-tree').jstree(true).settings) {
		// update existing tree
		$('#lib-tree').jstree(true).settings.core.data = ygg;
		$('#lib-tree').jstree(true).refresh();
	} else {
		// build tree
		$('#lib-tree').jstree({ core: { data: ygg } });
	}
}

function _lib_populate_rview(vobj, $scope) {
	// get group files
	tkcore.db.query_files({ tdex_id: vobj.id }, function(err, docs) {
		for(ti in docs) {
			docs[ti].sort_filename = docs[ti].location[docs[ti].default_location].fpath.file;
		}
		$scope.flist = docs;

		// map icons to each file
		for(ti in $scope.flist) {
			var tff = $scope.flist[ti];
			if(tff.status == 'complete') $scope.flist[ti].__icon = 'fa-circle ricon-blue';
			else if($scope.selection.filter(function(x) { return x._id == tff._id; }).length) $scope.flist[ti].__icon = 'fa-check-circle-o ricon-green';
			else if(tff.series_id === null || tff.episode_id === null) $scope.flist[ti].__icon = 'fa-exclamation-triangle ricon-red';
			else $scope.flist[ti].__icon = 'fa-circle-o ricon-default';
		}

		$scope.reorder('sort_filename');
		_lib_scopeApply($scope);

		// reset file-all checkbox
		$('#file-all').prop('checked', false);
		$('#file-all').prop('indeterminate', false);
	});
}

function _lib_event_keydown(evt) {
	//console.log("got keydown event; hasFocus = "+$scope.hasFocus+"; evt =",evt);

	var delkey = "Delete";
	if(tkversion.os == "darwin") delkey = "Backspace";

	if($scope.hasFocus == 'modal' && $scope.modal.$isShown === true) {
		if(evt.code == "Enter" || evt.code == "NumpadEnter") {
			$scope.modal.confirm();
		} else if(evt.code == "Escape") {
			$scope.modal.hide();
		}
	} else if($scope.hasFocus == 'rport' && $('.focused').length == 1) {
		var llen = $('.fentry').length;

		if(evt.code == "ArrowDown" || evt.code == "ArrowUp") {
			if($scope.selected === null) {
				// if nothing previously selected, choose first entry (up or down)
				$scope.flist_select(evt, $('.fentry')[0].id.split('-')[1]);
			} else {
				var iNext;
				if(evt.code == "ArrowDown") {
					iNext = $scope.selected.tindex + 1;
					if(iNext >= llen) iNext = llen - 1;
				} else {
					iNext = $scope.selected.tindex - 1;
					if(iNext < 0) iNext = 0;
				}
				$scope.flist_select(evt, $('.fentry')[iNext].id.split('-')[1]);
			}
		} else if(evt.code == "Home") {
			// choose first entry
			$scope.flist_select(evt, $('.fentry')[0].id.split('-')[1]);
		} else if(evt.code == "End") {
			// choose last entry
			$scope.flist_select(evt, $('.fentry')[llen-1].id.split('-')[1]);
		} else if(evt.code == delkey && evt.shiftKey === false) {
			// ignore selected
			$scope.ignoreSelected();
			// prevent default - required for Mac to prevent going 'back'
			evt.preventDefault();
			return false;
		} else if(evt.code == "KeyA" && evt.ctrlKey === true) {
			$scope.selectAll();
			evt.preventDefault();
			return false;
		} else if(evt.code == delkey && evt.shiftKey === true) {
			// delete selected
			$scope.deleteSelected();
			// prevent default - required for Mac to prevent going 'back'
			evt.preventDefault();
			return false;
		} else if(evt.code == "Enter" || evt.code == "NumpadEnter") {
			// add to working selection
			$scope.addToSelection();
			evt.preventDefault();
			return false;
		}
	} else if($scope.hasFocus == 'modal') {
		if($scope.modal.keydown) $scope.modal.keydown(evt);
	} else if($scope.hasFocus == 'ssmodal') {
		if($scope.ssmodal.keydown) $scope.ssmodal.keydown(evt);
	}
}

function _lib_rview_contextmenu(evt) {
	var iid;

	try {
		iid = evt.target.parentElement.id.split('-')[1];
	} catch(e) {
		iid = null;
	}

	if(iid) {
		// determine if the file we right-clicked is already selected.
		// if so, don't deselect the other elements (eg. might be part of a multi-select)
		if(!$('#row-'+iid).hasClass('selected')) {
			// nope, it was not already selected
			// deselect all; select this one
			$('.selected').removeClass('selected');
			$('#row-'+iid).addClass('selected');
			$('#file-'+iid).prop('checked', true);
		}

		var delkey = "Delete";
		if(tkversion.os == "darwin") delkey = "Backspace";

		// create context menu
		var fmenu = new nw.Menu();
		fmenu.append(new nw.MenuItem({ label: "Add to Selection", key: "Enter", click: $scope.addToSelection }));
		fmenu.append(new nw.MenuItem({ type: 'separator' }));
		fmenu.append(new nw.MenuItem({ label: "Properties...", click: $scope.filePropDiag }));
		fmenu.append(new nw.MenuItem({ type: 'separator' }));
		fmenu.append(new nw.MenuItem({ label: "Ignore", key: delkey, click: $scope.ignoreSelected }));
		fmenu.append(new nw.MenuItem({ label: "Delete", key: delkey, modifiers: "shift", click: $scope.deleteSelected }));

		// pop it gud
		fmenu.popup(evt.x, evt.y);
	}

	evt.preventDefault();
	return false;
}

function _lib_tree_contextmenu(evt) {
	var iid;

	try {
		iid = evt.target.parentElement.id;
	} catch(e) {
		iid = null;
	}

	if(iid) {
		// deselect all; select this one
		var delkey = "Delete";
		if(tkversion.os == "darwin") delkey = "Backspace";

		// create context menu
		var fmenu = new nw.Menu();
		fmenu.append(new nw.MenuItem({ label: "Properties...", click: $scope.seriesPropDiag }));
		fmenu.append(new nw.MenuItem({ label: "Change identifier..." }));
		fmenu.append(new nw.MenuItem({ type: 'separator' }));
		fmenu.append(new nw.MenuItem({ label: "Ignore All", key: delkey, click: $scope.ignoreSelected }));

		// pop it gud
		fmenu.popup(evt.x, evt.y);
	}

	evt.preventDefault();
	return false;
}

function _lib_openDirDialog(_cbx) {
	var od = $('#openDialog');
	od.attr('nwdirectory', true);
	od.unbind('change');
	od.val(null);
	od.change(function(evt) {
		_cbx($('#openDialog').val());
	});
	od.trigger('click');
}

function _lib_openFileDialog(_cbx) {
	var od = $('#openDialog');
	od.attr('nwdirectory', false);
	od.unbind('change');
	od.val(null);
	od.change(function(evt) {
		_cbx($('#openDialog').val());
	});
	od.trigger('click');
}

function _lib_scopeApply($scope) {
	if(!$scope.$$phase) {
		//console.log("[_lib_scopeApply] $scope.$apply()");
		$scope.$apply();
		return true;
	} else {
		//console.log("[_lib_scopeApply] $$phase active, skipping $apply");
		return false;
	}
}

function _lib_get_flist_selection(slist, flist) {
	var ilist = [];
	for(var tf = 0; tf < slist.length; tf++) {
		// match file ID to flist (contains full file entry)
		var tfid = slist[tf].id.replace(/^row\-/,'');
		ilist.push(flist.filter(function(x) { return x._id == tfid; })[0]);
	}
	return ilist;
}
