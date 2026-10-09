import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  timeout: 120000,
  use: { baseURL: "http://localhost:8080", channel: "chrome", headless: true },
  reporter: "list",
});
