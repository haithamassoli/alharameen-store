import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  astro: true,
  // Vendored agent skills are pinned by hash in skills-lock.json.
  ignorePatterns: [...(ultracite.ignorePatterns ?? []), ".agents/**"],
});
