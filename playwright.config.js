import fs from 'node:fs';
import { defineConfig } from '@playwright/test';

const envFile = new URL('./e2e/browser.env', import.meta.url);
for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
}

const port = process.env.OVERNIGHT_WEB_PORT || '5195';
const webUrl = process.env.OVERNIGHT_WEB || `http://127.0.0.1:${port}`;
if (!process.env.OVERNIGHT_API && process.env.VITE_API_URL) {
  process.env.OVERNIGHT_API = process.env.VITE_API_URL;
}

export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  expect: { timeout: 20000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  webServer: {
    command: `bash -lc 'set -a; source e2e/browser.env; set +a; npx vite --mode development --host 127.0.0.1 --port ${port}'`,
    url: webUrl,
    reuseExistingServer: false,
    timeout: 120000,
  },
  use: {
    baseURL: webUrl,
    headless: true,
    viewport: { width: 1440, height: 900 },
    trace: 'off',
  },
});
