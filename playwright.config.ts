import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const backendPort = "3020";
const backendUrl = `http://127.0.0.1:${backendPort}`;
const backendDir = path.resolve(__dirname, "../YallaMotorsBackend");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: "http://127.0.0.1:3017",
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "npm run build && node -r dotenv/config node_modules/tsx/dist/cli.mjs prisma/seed.ts && node -r dotenv/config dist/server.js",
      cwd: backendDir,
      env: {
        DOTENV_CONFIG_PATH: ".env.test",
        PORT: backendPort,
        ADMIN_EMAIL: "e2e-admin@yallamotors.test",
        ADMIN_PASSWORD: "E2e-Admin-Password-123!",
      },
      url: `${backendUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev:e2e",
      env: {
        API_BASE_URL: backendUrl,
        NEXT_PUBLIC_API_BASE_URL: backendUrl,
      },
      url: "http://127.0.0.1:3017/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
