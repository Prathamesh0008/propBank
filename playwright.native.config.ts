import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: 'group2-routing.spec.ts',
  workers: 1,
  timeout: 120_000,
  use: { baseURL: 'http://127.0.0.1:18080', channel: 'chrome', headless: true },
  reporter: 'list',
  webServer: {
    command: 'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 18080',
    url: 'http://127.0.0.1:18080/',
    env: { PROPBANK_TEST_DIST_DIR: '.next-native-test' },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
