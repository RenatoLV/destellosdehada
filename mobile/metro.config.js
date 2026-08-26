const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Permite a Metro procesar los binarios .wasm de expo-sqlite en Web
config.resolver.assetExts.push('wasm');

module.exports = config;