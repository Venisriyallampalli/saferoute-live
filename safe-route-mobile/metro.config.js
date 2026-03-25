const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Keep Metro memory usage stable on lower-memory Windows machines.
config.maxWorkers = 1;

module.exports = withNativeWind(config, { input: "./global.css" });
