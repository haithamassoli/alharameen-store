// @ts-check
import { AstroPWAIntegration } from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  integrations: [
    AstroPWAIntegration({
      registerType: "autoUpdate",
      injectRegister: "auto",
      // globPatterns below already precaches the manifest icons.
      includeManifestIcons: false,
      manifest: {
        name: "متجر ساعات الحرمين",
        short_name: "ساعات الحرمين",
        description:
          "ساعات الأذان الأصلية من الحرمين، اطلبها عبر واتساب ونوصلها لجميع محافظات الأردن",
        theme_color: "#08191a",
        background_color: "#08191a",
        display: "standalone",
        start_url: "/",
        lang: "ar",
        dir: "rtl",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      // Multipage store: no SPA navigation fallback, and precache only hashed
      // assets + icons. Never add cart/checkout/account responses to SW caches.
      generateSW: {
        navigateFallback: null,
        // _astro/ is empty until pages ship CSS/JS bundles.
        globStrict: false,
        globPatterns: ["_astro/**/*.{css,js,woff2}", "*.{svg,png,ico}"],
        // The lazy three.js hero chunk is only fetched when the 3D watch can
        // run, and the Arabic pages never request these font subsets; leave
        // both to the HTTP cache instead of downloading them on install.
        globIgnores: [
          "_astro/hero-watch.*.js",
          "_astro/*-{math,symbols,vietnamese,latin-ext}-*.woff2",
        ],
      },
    }),
  ],
});
