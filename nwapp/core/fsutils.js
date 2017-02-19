/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * fsutils.js
 * File utility functions
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var xattr = require('fs-xattr');
var pkgdata = require("../package");
var logthis = require('./logthis');

function xattr_set_ignore(fpath, _cbx) {
	if(typeof _cbx == 'undefined') _cbx = null;

	var err;
	if(_cbx) {
		xattr.set(fpath, 'user.xbake.ignore', '1', function(err) {
			if(err) {
				logthis.error("Failed to set xattrib for [%s]",fpath, { error: e, file: fpath, xattr: 'user.xbake.ignore', xval: '1' });
				_cbx(false);
			} else {
				_cbx(true);
			}
		});
	} else {
		try {
			err = xattr.setSync(fpath, 'user.xbake.ignore', '1');
		} catch(e) {
			logthis.error("Failed to set xattrib for [%s]",fpath, { error: e, file: fpath, xattr: 'user.xbake.ignore', xval: '1' });
			return false;
		}
		return true;
	}
}

/**
 * Exports
 **/

exports.xattr_set_ignore		= xattr_set_ignore;
