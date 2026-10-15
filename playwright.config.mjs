import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60000,
  use: { baseURL: "http://127.0.0.1:4173/Projeto-T3B-Modernizacao/", viewport: { width: 1440, height: 1000 }, timezoneId: "America/Sao_Paulo", channel: process.env.PLAYWRIGHT_CHANNEL },
  webServer: {
    command: "node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173 --strictPort",
    url: "http://127.0.0.1:4173/Projeto-T3B-Modernizacao/",
    reuseExistingServer: !process.env.CI,
  },
});
