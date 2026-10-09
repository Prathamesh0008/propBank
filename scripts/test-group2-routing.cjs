const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--config','playwright.native.config.ts'],{stdio:'inherit',env:process.env});
process.exitCode=result.status??1;
