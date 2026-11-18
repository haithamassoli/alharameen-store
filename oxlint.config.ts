import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import astro from "ultracite/oxlint/astro";
import core from "ultracite/oxlint/core";

// Biome (ultracite/biome) formats + lints; Oxlint adds type-aware rules and
// the anti-slop plugin that rejects common AI-generated escape hatches.
export default defineConfig({
  env: core.env,
  extends: [core, astro, antiSlop],
  ignorePatterns: [...core.ignorePatterns, "dev-dist/**"],
  options: { typeAware: true },
  overrides: [
    {
      // Astro convention: components and layouts are PascalCase.
      files: ["**/*.astro"],
      rules: {
        "unicorn/filename-case": [
          "error",
          { cases: { kebabCase: true, pascalCase: true } },
        ],
      },
    },
  ],
});
