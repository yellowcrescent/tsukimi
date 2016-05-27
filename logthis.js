/**
 ******************************************************************************
 **%%vim: set modelines=15:
 *
 * logthis.js
 * Logging functions
 *
 * Copyright (c) 2016 Jacob Hipps/Neo-Retro Group, Inc.
 * https://ycnrg.org/
 *
 * @author      Jacob Hipps - jacob@ycnrg.org
 * @license     MPLv2 <https://www.mozilla.org/en-US/MPL/2.0/>
 * @param       vim: set ts=4 sw=4 noexpandtab syntax=javascript:
 *
 *****************************************************************************/

var settings = require("./settings");
var C = require('chalk');
var winston = require('winston');
require('winston-mongodb').MongoDB;

// instantiate a Winston logger object
var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({
			name: 'console-logger',
			level: 'debug',
			colorize: true,
			handleExceptions: true,
			timestamp: function() {
				return Date.now();
			},
			formatter: function(options) {
				var lcolored;
				var msgcolor = 'reset';
				if(options.level == 'warning') { lcolored = C.yellow.underline('<'+options.level+'>'); msgcolor = 'yellow'; }
				else if(options.level == 'error') { lcolored = C.red.underline('<'+options.level+'>'); msgcolor = 'red'; }
				else if(options.level == 'info') lcolored = C.green.underline('<'+options.level+'>');
				else lcolored = C.gray('<'+options.level+'>');
				return C.white('['+(new Date(options.timestamp())).toISOString()+']') + " " + lcolored + " " +
				       (undefined !== options.message ? C[msgcolor](options.message) : '') +
				       (options.meta && Object.keys(options.meta).length ? '\n\t'+ C.cyan(JSON.stringify(options.meta)) : '' );
			}
		}),
		new (winston.transports.MongoDB)({
			name: 'mongo-logger',
			level: 'info',
			db: settings.mongo,
			collection: 'log',
			storeHost: true,
			capped: true,
			cappedMax: 1000000
		})
	],
	exitOnError: false
});

module.exports = logger;
