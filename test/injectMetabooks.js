#!/usr/bin/env node
"use strict";

/**
 * Script to inject metabook files into the OCG service. It will produce failure files
 * if things fail to render or inject.
 */

require( 'es6-shim' );
require( 'prfun' );
var commander = require( 'commander' );
var path = require( 'path' );
var fs = require( 'fs' );
var request = require( 'request' );
var url = require( 'url' );

commander
	.version( '0.0.1' )
	.option( '-f, --file <filepath>', 'Path to the test metabook file' )
	.option( '-u, --apiurl <url>', 'URL to server, http://localhost:17080' )
	.option( '-r, --renderer <renderer>', 'Renderer to exercise, rdf2latex')
	.parse( process.argv );

var inputFile = commander.file,
	apiUrl = commander.apiurl || 'http://localhost:17080',
	renderer = commander.renderer || 'rdf2latex';

if ( !inputFile ) {
	console.error( 'Need input file, use -f' )
}

var startedAt;

var states = {
	'failed_inject': [],
	'failed': [],
	'finished': []
};

var metabooks = [];
var lineSplit;
console.info( 'Reading in file' );
fs.readFileSync( inputFile, { encoding: 'utf8' } ).split( '\n' ).forEach( function( line, idx ) {
	lineSplit = line.match(/^([0-9]+\.[0-9]*) - (([0-9a-zA-Z]*) - )?(.+)$/);
	if ( lineSplit ) {
		metabooks.push( {
			line: idx,
			time: lineSplit[1],
			metabook: lineSplit[4],
			metabookId: null,
			status: null
		} );
	}
} );
console.info( 'Read in %s metabooks', metabooks.length );

function submitMetabook( val, idx ) {
	if ( idx % 1000 === 0 ) {
		console.info( 'Starting render request %s', idx );
	}
	return new Promise( function( resolve, reject ) {
		request(
			{
				url: apiUrl,
				method: 'POST',
				encoding: 'utf8',
				pool: false,
				form: { command: 'render', 'writer': renderer, metabook: val.metabook }
			},
			function(error, response, body) {
				if ( error || response.statusCode !== 200 ) {
					val.status = 'failed_inject';
					states.failed_inject.push( val );
					console.error( 'Failed to submit line %s, error: %s, %s',
						val.line, error, body );
				} else {
					val.metabookId = JSON.parse( body ).collection_id;
				}
				resolve();
			}
		);
	} );
}
function checkStatus( val, idx ) {
	if ( idx % 1000 === 0 ) {
		console.info( 'Checking render status %s', idx );
	}
	if ( !val.status ) {
		// Check the status :)
		return new Promise( function( resolve, reject ) {
			var rurl = apiUrl + '?command=render_status&collection_id=' + val.metabookId;
			request(
				{
					url: rurl,
					method: 'GET',
					encoding: 'utf8',
					pool: false
				},
				function(error, response, body) {
					if ( response.statusCode === 200 ) {
						var state = JSON.parse( body ).state;
						if ( state !== 'pending' ) {
							console.info( "Job %s: %s", val.metabookId, state );
						}
						if ( state === 'failed' || state === 'finished' ) {
							val.status = state;
							states[state].push( val );
						}
					}
					resolve();
				}
			);
		} );
	}
}
var guardedSubmit = Promise.guard( 10, submitMetabook );
var guardedCheck = Promise.guard( 10, checkStatus );

function checkCompletion() {
	console.info( "Beginning check run of %s results", metabooks.length );
	Promise.map( metabooks, guardedCheck )
		.then( writeResults )
		.then( function( finished ) {
			if ( finished ) {
				console.info( "Started at %s, Done at %s", startedAt, Date.now() );
			} else {
				// Start another async loop...
				setTimeout( checkCompletion, 30000 );
			}
		} );
}

function writeResults() {
	var numCompleted = states.failed_inject.length + states.failed.length + states.finished.length;
	console.info( '%s%% of jobs complete (%s%% Failed submit, %s%% Failed, %s%% Success)',
		numCompleted / metabooks.length * 100,
		states.failed_inject.length / metabooks.length * 100,
		states.failed.length / metabooks.length * 100,
		states.finished.length / metabooks.length * 100
	);
	console.info( 'writing fail files' );
	var fi = fs.openSync( 'failed.txt', 'w' );
	states.failed.forEach( function( val ) {
		fs.writeSync( fi, val.time + ' - ' + val.metabookId + ' - ' + val.metabook + '\n' );
	} );
	fs.close( fi );

	return numCompleted === metabooks.length;
}

console.info( 'Beginning torture session, submitting %s metabooks :D', metabooks.length );
startedAt = Date.now();
Promise.map( metabooks, guardedSubmit )
	.then( function() {
		console.info( 'Submit complete, writing failed inject file');
		// Write failed_inject file
		var fi = fs.openSync( 'failed_inject.txt', 'w' );
		states.failed_inject.forEach( function( val ) {
			fs.writeSync( fi, val.time + ' - ' + ' - ' + val.metabook + '\n' );
		} );
		fs.close( fi );

		checkCompletion();
	} )
	.done();
