all: debug

core:
	export LINK=g++
	rm -f ./package.json
	npm cache clear
	npm install when semver
	./unify-package-json.js
	npm install
	npm update
	npm dedupe

production: core
	npm prune --production
	rm -rf ./node_modules/icu-bidi/build

debug: core
	npm prune

clean:
	rm -rf ./node_modules
