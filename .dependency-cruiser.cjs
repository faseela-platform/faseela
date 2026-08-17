/**
 * Deep-module boundaries — see docs/adr/0004-packages-are-deep-modules.md
 *
 * A package's public surface is its ROOT FILES (entry points). Anything in a
 * subfolder is private. Adding a public surface means adding a root file, not
 * editing a barrel.
 */
const PACKAGES_ROOT = "packages";

module.exports = {
  forbidden: [
    {
      name: "entry-point-boundary",
      comment:
        "Code outside a package may import only that package's entry points (its root files), never its subfolders.",
      severity: "error",
      from: {
        pathNot: `^${PACKAGES_ROOT}/([^/]+)/`,
      },
      to: {
        path: `^${PACKAGES_ROOT}/([^/]+)/[^/]+/`,
      },
    },
    {
      name: "cross-package-deep-import",
      comment:
        "One package may not reach into another package's subfolders — go through its entry points.",
      severity: "error",
      from: {
        path: `^${PACKAGES_ROOT}/([^/]+)/`,
      },
      to: {
        path: `^${PACKAGES_ROOT}/([^/]+)/[^/]+/`,
        pathNot: [`^${PACKAGES_ROOT}/$1/`],
      },
    },
    {
      name: "tests-through-entrypoints",
      comment:
        "Tests import packages through their entry points and their own tests/ fixtures — never any package's internals.",
      severity: "error",
      from: {
        path: `^${PACKAGES_ROOT}/([^/]+)/tests/`,
      },
      to: {
        path: `^${PACKAGES_ROOT}/([^/]+)/(?!tests/)[^/]+/`,
      },
    },
    {
      name: "no-circular",
      comment: "No dependency cycles.",
      severity: "error",
      from: {},
      to: {
        circular: true,
      },
    },
    {
      name: "no-orphans",
      comment: "Unreachable module — delete it or wire it up.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          "(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$",
          "\\.d\\.ts$",
          "(^|/)tsconfig\\.json$",
          // Framework-convention config: loaded by name by Next, PostCSS and ESLint rather than
          // imported, so they are orphans by design and always will be. Listing them explicitly keeps
          // the rule's signal meaningful — an orphan warning should mean dead code, not tooling.
          "(^|/)(babel|webpack|next|postcss|vitest|tailwind|drizzle|playwright|metro)\\.config\\.(js|cjs|mjs|ts)$",
          // Expo Router's filesystem routing: files under apps/native/app/ are routes,
          // discovered by path exactly as Next discovers apps/web/app/, so nothing imports them.
          "^apps/native/app/",
          "(^|/)eslint\\.config\\.(js|cjs|mjs|ts)$",
          // Payload writes `cms/payload-types.ts` from the collection configs on every
          // schema change. It is currently unimported because nothing reads CMS content
          // yet, and it will stop being an orphan the moment a page does. Regenerating it
          // is not optional, so warning about it trains us to ignore this rule.
          "^apps/web/cms/payload-types\\.ts$",
          // The browser-side auth client. Orphaned only because no sign-in UI exists yet;
          // the server half is wired and verified end to end by scripts/verify-auth-flow.mjs.
          // Remove this exemption once a Client Component imports it.
          "^apps/web/lib/auth-client\\.ts$",
        ],
      },
      to: {},
    },
    // Layering — which packages may depend on which.
    {
      name: "native-stays-off-the-db",
      comment:
        "The Expo app consumes HTTP (/api/v1/*), never the database — packages/db is node-postgres and cannot run on a phone. An import here compiles on a laptop and dies on a device.",
      severity: "error",
      from: {
        path: "^apps/native/",
      },
      to: {
        path: `^${PACKAGES_ROOT}/db/`,
      },
    },
    {
      name: "api-types-depends-on-nothing",
      comment:
        "packages/api-types is the wire contract both web and native import; zero dependencies is what lets it bundle for a phone. Its input types are structural on purpose — do not 'fix' that by importing @faseela/db.",
      severity: "error",
      from: {
        path: `^${PACKAGES_ROOT}/api-types/`,
      },
      to: {
        path: `^${PACKAGES_ROOT}/`,
        pathNot: [`^${PACKAGES_ROOT}/api-types/`],
      },
    },
  ],
  options: {
    doNotFollow: {
      path: ["node_modules", "\\.next", "dist", "build"],
    },
    exclude: {
      path: ["\\.next/", "node_modules/", "dist/", "build/", "coverage/"],
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: "tsconfig.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
