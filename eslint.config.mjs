import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // The two reference projects that happen to live inside this folder. They are separate
    // applications with their own toolchains — linting them here reports thousands of problems
    // that belong to them, not to this one.
    "pefa-kiwanja/**",
    "school_mgmt/**",
  ]),

  {
    rules: {
      /*
       * next/image is not used anywhere in this project, and that is deliberate.
       *
       * Every image here comes from Cloudinary, which already does what next/image does —
       * resizing, format negotiation, and a CDN — and does it at the edge rather than in the
       * Node process. lib/cloudinary.ts's `cdn()` asks for the exact size each place needs.
       * Running both would mean paying for the work twice and losing Cloudinary's cache.
       */
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
