import { defineConfig, devices } from "@playwright/test";

// E2E: `npm run test:e2e` sobe o app local (next start); com E2E_BASE_URL roda contra uma URL publicada.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const useLocalServer = !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL,
    locale: "pt-BR",
    timezoneId: "America/Sao_Paulo",
    trace: "retain-on-failure",
    // Usa o Chrome instalado na máquina (sem download de navegadores).
    channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.E2E_BROWSER_CHANNEL ?? "chrome" } },
  ],
  webServer: useLocalServer
    ? {
        command: "npm run start -- -p 3100",
        url: "http://localhost:3100/login",
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
