import { defineConfig, devices } from "@playwright/test";

/**
 * Uji E2E (Playwright). Menjalankan dev server `pnpm run dev` (https, port 3011, base `/solidjs-experimental`) lalu menguji editor di browser sungguhan.
 *   pnpm e2e              # semua uji (memulai dev server bila belum jalan)
 *   pnpm e2e:ui           # mode UI interaktif
 *   E2E_BASE_URL=https://localhost:3011/solidjs-experimental/ pnpm e2e   # pakai server yang sudah berjalan
 * Peramban dipasang sekali dengan `pnpm exec playwright install chromium`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3011);
// Slash akhir wajib: Playwright me-resolve `goto("xlsx-preview")` relatif terhadap base (tanpa slash, path `/solidjs-experimental` terbuang).
const BASE_URL = process.env.E2E_BASE_URL ?? `https://localhost:${PORT}/solidjs-experimental/`;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]],
  outputDir: "test-results",
  use: {
    baseURL: BASE_URL,
    ignoreHTTPSErrors: true,
    acceptDownloads: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm run dev",
        url: BASE_URL,
        ignoreHTTPSErrors: true,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
