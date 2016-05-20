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

function libraryController($scope, $location, $routeParams, $http, $filter, $modal, $alert) {
	console.log("libraryController start");

	$scope.flist = [];
	$scope.hasFocus = null;
	$scope.selected = null;
	$scope.modeToggle = false;
	$scope.modal = { '$isShown': false };
	$scope.scanStatus = { title: "", content: "", iconClassList: [] };
	var paneList = ['sidebar', 'rport'];
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
		//console.log("File selected: "+fid);
		//console.log("Event: ",$event);
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
		if(totSelected == 0) {
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
		//console.log("Set focus: "+elem);
		$scope.hasFocus = elem;
		$('#'+elem).addClass('focused');
	};

	$scope.ignoreSelected = function() {
		console.log("ignoreSelected");

		// show modal
		$scope.modal = $modal({ title: "Confirm Ignore", templateUrl: "/public/views/partials/modal_ignore_confirm.html", scope: $scope });

		// callback
		$scope.modal.confirm = function() {
			var slist = $('.fentry.selected');
			console.log("slist =", slist);
			for(var ti = 0; ti < slist.length; ti++) {
				console.log("ignore: ", slist[ti]);
			}
			$scope.modal.hide();
		};

	};

	$scope.deleteSelected = function () {
		console.log("deleteSelected");

		// build modal confirmation dialog
		$scope.modal = $modal({ title: "Confirm Delete", templateUrl: "/public/views/partials/modal_basic.html", scope: $scope, content: "Delete file(s) from disk and remove corresponding database entries? <br/><b>This cannot be undone</b>" });
		$scope.modal.confirmText = "Delete";
		$scope.modal.confirmClass = "btn-danger";
		$scope.modal.contentIcon = "fa-warning";

		// callback
		$scope.modal.confirm = function() {
			var slist = $('.fentry.selected');
			console.log("slist =", slist);
			for(var ti = 0; ti < slist.length; ti++) {
				console.log("delete: ", slist[ti]);
			}
			$scope.modal.hide();
		};

	};

	$scope.seriesPropDiag = function() {
		var ccf = $('#lib-tree').jstree(true).get_selected(true)[0].original;
		var iid = ccf.id;
		console.log("seriesPropDiag; id = "+iid);

		tkcore.db.get_series_data(function(slist) {
			// build property data
			$scope.sprop = { tdex_id: ccf.id, series_id: ccf.series_id, serdata: slist[ccf.series_id], seriesSelected: slist[ccf.series_id] };
			$scope.serdata = slist;
			console.log("seriesPropDiag modal data:", $scope.sprop);

			// build modal properties dialog
			$scope.modal = $modal({ title: iid, templateUrl: "/public/views/partials/modal_prop_series.html", scope: $scope });

			// set up 'save' callback
			$scope.modal.confirm = function() {
				// TODO: save stuff
				$scope.modal.hide();
			};

			// set up 'series_id' change callback
			$scope.modal.seriesChange = function() {
				if($scope.sprop.seriesSelected != null) {
					$scope.sprop.series_id = $scope.sprop.seriesSelected._id;
					$scope.sprop.serdata = $scope.serdata[$scope.sprop.series_id];
				} else {
					$scope.sprop.series_id = null;
					$scope.sprop.serdata = null;
				}
				//_lib_scopeApply($scope);
			};

			_lib_scopeApply($scope);
		});
	};

	$scope.openLocal = function() {
		// launch 'open folder' dialog and create callback
		_lib_openDirDialog(function(sdir) {
			console.log("Scanning directory: "+sdir);
			$scope.scanStatus = { title: "Scanning", content: "Scanning directory: "+sdir, iconClassList: ['fa','fa-spin','fa-moon-o'], show: true };
			tkcore.scanner.xbake_scandir(sdir, function(sdata) {
				switch(sdata.msgtype) {
					case '_exception':
						console.log("!! XBake: Exception: "+sdata.msg);
						$scope.scanStatus.title = "Error";
						$scope.scanStatus.content = "XBake Exception: "+sdata.msg;
						$scope.scanStatus.type = 'danger';
						break;
					case '_close':
						console.log("** XBake exited. exitcode = "+sdata.exitcode);
						break;
					case 'complete':
						console.log("Scan complete! Files: "+sdata.files+", Series: "+sdata.series);
						$scope.scanStatus.title = "Scan complete";
						$scope.scanStatus.content = "Scanned: "+sdata.files+" files / "+sdata.series+" series";
						$scope.scanStatus.iconClassList = ['fa','fa-check-circle-o'];
						$scope.refresh();
						break;
					case 'scanfile':
						console.log("Scanning file: "+sdata.filename);
						$scope.scanStatus.title = "Scanning";
						$scope.scanStatus.content = sdata.filename;
						break;
					case 'series_scrape':
						console.log("Scraping: "+sdata.tdex_id+" ("+sdata.tdex_data.title+")");
						$scope.scanStatus.title = "Scraping";
						$scope.scanStatus.content = sdata.tdex_id+" ("+sdata.tdex_data.title+")";
						break;
					default:
						console.log("[xbake status] "+sdata.msgtype+": "+JSON.stringify(sdata));
						break;
				}
				_lib_scopeApply($scope);
			});
		});
	};

	$scope.refresh = function() {
		console.log("library->refresh");
		// make spinny thing spin
		$('#btn-refresh').addClass("fa-spin");

		// get series data
		tkcore.db.get_series_data(function(sers) {

			// get tdex group data
			tkcore.db.get_file_groups(function(err, rez) {
				if(err) {
					console.log("ERROR: Failed to retrieve file group listing: "+err);
					$('#btn-refresh').removeClass("fa-spin");
					return;
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

	// perform initial update
	$scope.refresh();

	window.$scope = $scope;
}

function _lib_build_tree(indata, sdata) {
	var ygg = [];
	for(ti in indata) {
		var tg = indata[ti];
		var tsd = sdata[tg.series_id];
		var tnode = {
						id: tg.tdex_id,
						series_id: tg.series_id,
						text: (tsd ? tsd.title : tg.tdex_id),
						icon: "fa " + (tg.series_id ? "fa-circle-o" : "fa-exclamation-triangle")
					}
		ygg.push(tnode)
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
		//console.log("populating flist:",docs);
		$scope.flist = docs;
		$scope.reorder('sort_filename');
		_lib_scopeApply($scope);

		// reset file-all checkbox
		$('#file-all').prop('checked', false);
		$('#file-all').prop('indeterminate', false);
	});
}

function _lib_event_keydown(evt) {
	console.log("got keydown event",evt);

	var delkey = "Delete";
	if(tkversion.os == "darwin") delkey = "Backspace";

	if($scope.modal.$isShown == true) {
		if(evt.code == "Enter") {
			$scope.modal.confirm();
		} else if(evt.code == "Escape") {
			$scope.modal.hide();
		}
	} else if($scope.hasFocus == 'rport' && $('.focused').length == 1) {
		var llen = $('.fentry').length;

		if(evt.code == "ArrowDown" || evt.code == "ArrowUp") {
			if($scope.selected == null) {
				// if nothing previously selected, choose first entry (up or down)
				$scope.flist_select(evt, $('.fentry')[0].id.split('-')[1]);
			} else {
				var iNext;
				if(evt.keyIdentifier == "Down") {
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
		} else if(evt.code == delkey && evt.shiftKey == false) {
			// ignore selected
			$scope.ignoreSelected();
			// prevent default - required for Mac to prevent going 'back'
			evt.preventDefault();
			return false;
		} else if(evt.code == delkey && evt.shiftKey == true) {
			// delete selected
			$scope.deleteSelected();
			// prevent default - required for Mac to prevent going 'back'
			evt.preventDefault();
			return false;
		}
	}
}

function _lib_rview_contextmenu(evt) {
	console.log("got rview contextmenu event");
	var iid;

	try {
		iid = evt.target.parentElement.id.split('-')[1];
	} catch(e) {
		iid = null;
	}

	if(iid) {
		// deselect all; select this one
		$('.selected').removeClass('selected');
		$('#row-'+iid).addClass('selected');
		$('#file-'+iid).prop('checked', true);

		var delkey = "Delete";
		if(tkversion.os == "darwin") delkey = "Backspace";

		// create context menu
		var fmenu = new nw.Menu();
		fmenu.append(new nw.MenuItem({ label: "Properties..." }));
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
	console.log("got rview contextmenu event");
	console.log("evt =",evt);
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
		console.log("[_lib_scopeApply] $scope.$apply()");
		$scope.$apply();
		return true;
	} else {
		console.log("[_lib_scopeApply] $$phase active, skipping $apply");
		return false;
	}
}
