import { defineConfig, devices } from "@playwright/test";

const PORT = 4321;
const isCI = process.env.CI !== undefined;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? "github" : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  // Tests the production build (PWA service worker only exists there).
  webServer: {
    command: `pnpm build && pnpm preview --port ${PORT} --ignore-lock`,
    port: PORT,
    reuseExistingServer: !isCI,
  },
});
