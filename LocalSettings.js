module.exports = function (config) {
	config.coordinator.frontend_threads = 2;
	config.coordinator.backend_threads = "auto";

	return config;
}

