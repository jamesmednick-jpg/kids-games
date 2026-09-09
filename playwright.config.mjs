import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:4173',
    ...devices['iPhone 15'],
    browserName: 'chromium',
  },
  webServer: {
    command: 'node tools/serve.mjs 4173',
    port: 4173,
    reuseExistingServer: true,
  },
});
