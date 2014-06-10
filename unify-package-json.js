#!/usr/bin/env nodejs

/**
 * Make script to composite dependencies of node modules into one big file.
 *
 * This will find all package.json files recursively and merge them into one.
 * It will throw errors if multiple files reference different versions of the
 * same upstream package.
 *
 * Ironically; this script itself has dependencies in the form of the `prfun`
 * library (since we want to use fancy non-standard Promise features).
 */

var child_process = require( 'child_process' ),
	semver = require( 'semver' ),
	fs = require( 'fs' ),
	path = require( 'path' ),
	util = require( 'util' );

try {
	require('prfun');
} catch ( err ) {
	console.err( "The 'prfun' library could not be loaded. Please `npm install prfun`")
}

function findPackageJson() {
	var readdir = Promise.promisify(fs.readdir, fs);
	return readdir( __dirname ).then( function( files ) {
		return files.map( function( f ) {
			return path.join( __dirname, f, "package.json" );
		} ).filter( function ( f ) {
			return fs.existsSync( f );
		} );
	} );
}

function readPackageJson( files ) {
	return files.map(
		function( file ) {
			return require( file );
		}
	);
}

function buildDependencies( packageObjs ) {
	var glodeps, optdeps, glodevdeps;
	var iterate = function iterate( key, arrayObj ) {
		var unifiedDeps = new Map();

		arrayObj.forEach( function( el ) {
			var name = el.name,
			packdeps = el[key] || {};

			Object.keys(packdeps).forEach( function( pkg ) {
				var pkgver = packdeps[pkg];
				if ( !unifiedDeps.has( pkg ) ) {
					unifiedDeps.set( pkg, new Map() );
				}
				var vermap = unifiedDeps.get( pkg );
				if ( !vermap.has( pkgver ) ) {
					vermap.set( pkgver, new Set() );
				}
				vermap.get( pkgver ).add( name );
			} );
		} );
		// Go through and combine versions for a given package with the
		// "and" operator (which for semver is a space) and let npm figure
		// out how to satisfy the conflict.  But emit diagnostics on
		// stderr to help us debug this if necessary.
		var result = {};
		unifiedDeps.forEach( function( vermap, pkg ) {
			result[ pkg ] = Array.from( vermap.keys() ).join( ' ' );
			var who = Array.from( vermap.values() );
			if ( who.length > 1 ) {
				console.warn(
					util.format(
						'* Could not reconcile common dependency on %s. (%s)',
						pkg,
						who.map( function( s ) {
							return Array.from( s.values() ).join(' ');
						}).join(', ')
					)
				);
			}
		} );
		return result;
	};

	console.info( 'Unifying runtime dependencies' );
	glodeps = iterate( 'dependencies', packageObjs );
	console.info( 'Unifying optional dependencies' );
	optdeps = iterate( 'optionalDependencies', packageObjs );
	console.info( 'Unifying unified development dependencies' );
	glodevdeps = iterate( 'devDependencies', packageObjs );

	return {
		'dependencies': glodeps,
		'optionalDependencies': optdeps,
		'devDependencies': glodevdeps
	};
}

function writePackageJson( deps ) {
	var packageObj = {
		name: "mw-ocg-service-bundle",
		description: "Common build dependency bundle for the MediaWiki Offline Content Generator",
		repository: {
			type: "git",
			url: "gerrit.wikimedia.org/r/mediawiki/services/ocg-collection"
		},

		dependencies: deps.dependencies,
		optionalDependencies: deps.optionalDependencies,
		devDependencies: deps.devDependencies
	};

	var writeFile = Promise.promisify(fs.writeFile, fs);
	return writeFile( 'package.json', JSON.stringify( packageObj, null, 2 ) ).
		then(function() {
			console.log('wrote file');
		} );
}

/* === Glue logic === */
findPackageJson()
	.then( readPackageJson )
	.then( Promise.method( buildDependencies ) )
	.then( writePackageJson )
	.done();


