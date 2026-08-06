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
          "(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts)$",
        ],
      },
      to: {},
    },
    // Layering — which packages may depend on which — is a separate concern.
    // Fill in as the package graph takes shape, e.g.:
    // {
    //   name: "ui-stays-presentational",
    //   severity: "error",
    //   from: { path: "^packages/ui/" },
    //   to: { path: "^packages/db/" },
    // },
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
