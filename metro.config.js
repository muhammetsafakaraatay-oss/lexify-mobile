const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

config.watchFolders = (config.watchFolders || [__dirname]).filter(
  (folder) => !folder.includes('.local')
);

config.resolver.blockList = [
  /\.local\/.*/,
];

module.exports = config;
