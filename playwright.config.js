import { defineConfig } from '@playwright/test';

const port = process.env.OVERNIGHT_WEB_PORT || '5174';

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.OVERNIGHT_WEB || `http://127.0.0.1:${port}`,
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
  },
});
