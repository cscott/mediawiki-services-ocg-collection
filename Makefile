all: debug

core:
	export LINK=g++
	npm install semver when
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
	rm -f ./package.json
	npm cache clear
	rm -rf ./node_modules
