const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Monorepo: watch the workspace root so edits to @faseela/* packages reload,
// and resolve from both the app's and the root's node_modules (pnpm isolated linker).
config.watchFolders = [path.resolve(__dirname, "../..")];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

// `@faseela/tokens` uses Node16-ESM specifiers (`./lib/motion.js` on disk is
// `motion.ts`). TypeScript and Vite both map the extension; Metro does not, so
// when a `.js` specifier fails, retry without the extension and let Metro's
// sourceExts find the `.ts` source.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  try {
    return resolve(context, moduleName, platform);
  } catch (error) {
    if (moduleName.endsWith(".js")) {
      return resolve(context, moduleName.slice(0, -3), platform);
    }
    throw error;
  }
};

module.exports = config;
