all: debug

core:
	rm ./package.json
	npm cache clear
	npm install when
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