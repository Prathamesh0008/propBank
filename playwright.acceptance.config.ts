import { defineConfig } from '@playwright/test';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
export default defineConfig({
  testDir:'./tests',testMatch:['acceptance.spec.ts','client-workflows.spec.ts'],workers:1,timeout:120000,
  use:{baseURL:'http://127.0.0.1:18080',channel:'chrome',headless:true},reporter:'list',outputDir:'.client-acceptance-results',
  webServer:[
    {command:'node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 18080',url:'http://127.0.0.1:18080',env:{PROPBANK_TEST_DIST_DIR:'.next-acceptance-test'},reuseExistingServer:false,timeout:120000},
    {command:'node tests/fixtures/acceptance-server.cjs',url:'http://127.0.0.1:18081/health',reuseExistingServer:false},
  ],
});
