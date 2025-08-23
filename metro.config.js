const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure for web compatibility
if (process.env.EXPO_PUBLIC_PLATFORM === 'web') {
  // Add web-specific configurations here if needed
  config.resolver.platforms = ['web', 'native', 'ios', 'android'];
}

module.exports = config;