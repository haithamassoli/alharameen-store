// @ts-check
import { AstroPWAIntegration } from "@vite-pwa/astro";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
  // Absolute URLs for canonical links, Open Graph and the sitemap.
  site: "https://alharameen.assoli.site",
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
        theme_color: "#ffffff",
        background_color: "#ffffff",
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
      },
    }),
  ],
});
