module.exports = function (config) {
	config.coordinator.frontend_threads = 2;
	config.coordinator.backend_threads = "auto";

	config.backend.bundler.bin = "/srv/deployment/ocg/ocg/mw-ocg-bundler/bin/mw-ocg-bundler";
	config.backend.writers.rdf2latex.bin = "/srv/deployment/ocg/ocg/mw-ocg-latexer/bin/mw-ocg-latexer";

	return config;
}

