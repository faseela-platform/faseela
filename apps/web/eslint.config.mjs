import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    /*
     * Payload writes these. Its migration signature is
     * `({ db, payload, req })` and most migrations use only `db`, so linting them
     * produces unused-argument warnings on code we must not edit — the CLI
     * rewrites `importMap.js` and the generated types on every schema change.
     *
     * `cms/migrations/*.ts` is the one exception we do hand-edit (the CREATE
     * SCHEMA line), which is why that edit is marked in a comment there.
     */
    "cms/migrations/**",
    "cms/payload-types.ts",
    "app/(payload)/admin/importMap.js",
  ]),
]);

export default eslintConfig;
