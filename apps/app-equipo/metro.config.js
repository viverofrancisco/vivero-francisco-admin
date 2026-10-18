// Monorepo-aware Metro config for Expo. See:
// https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Watch the whole workspace so changes in packages/shared trigger reloads.
config.watchFolders = [workspaceRoot];

// Resolve from local node_modules first, then the hoisted root one.
// Hierarchical lookup is left ENABLED so Metro can find packages nested under
// individual workspace deps (expo/expo-modules-core, expo-router/etc.).
// Single-version enforcement for react / react-native / react-native-safe-area
// is handled at the package-manager level via "overrides" in the root
// package.json, not here.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

module.exports = config;
