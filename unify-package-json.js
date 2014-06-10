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
	util = require( 'util' );

try {
	require('prfun');
} catch ( err ) {
	console.err( "The 'prfun' library could not be loaded. Please `npm install prfun`")
}

function findPackageJson() {
	return new Promise( function( resolve, reject ) {
		child_process.exec(
			'find . -path ./node_modules -prune -o -name package.json -print',
			function( error, stdout, stderr ) {
				files = stdout.trim().split( '\n' );
				resolve( files );
			}
		)
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
		var unifiedDeps = {};

		arrayObj.forEach( function( el ) {
			var name = el.name,
				packdeps = el[key],
				pkg, glover, pkgver;

			for ( pkg in packdeps ) {
				if ( !packdeps.hasOwnProperty( pkg ) ) {
					continue;
				}

				if ( pkg in unifiedDeps ) {
					// Check to see if the versions are compatible
					glover = unifiedDeps[pkg][0];
					pkgver = packdeps[pkg];

					// Strict equality is nice; they need the same thing
					if ( glover === pkgver ) {
						continue;
					}

					// If either is an approximate version (major / minor match) strip
					// the tidle so semver can process and then see if the other requirement matches
					if ( glover[0] === '~' && semver.satisfies( glover.substr( 1 ), pkgver ) ) {
						continue;
					}
					if ( pkgver[0] === '~' && semver.satisfies( pkgver.substr( 1 ), glover ) ) {
						continue;
					}

					// TODO: Handle greater than / less than.

					console.error(
						util.format(
							'Could not reconcile common dependency on %s. %s requires %s where %s requires %s.',
							pkg,
							unifiedDeps[pkg][1], glover,
							name, pkgver
						)
					);

				} else {
					// Not already used, just add it
					unifiedDeps[pkg] = [packdeps[pkg], name];
				}
			}
		} );

		// Clean the metadata we left
		for ( dep in unifiedDeps ) {
			if ( !unifiedDeps.hasOwnProperty( dep ) ) {
				continue;
			}
			unifiedDeps[dep] = unifiedDeps[dep][0];
		}

		return unifiedDeps;
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


