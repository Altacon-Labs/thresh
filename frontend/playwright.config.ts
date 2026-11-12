import { createHash } from "node:crypto";
import { defineConfig, devices } from "@playwright/test";

const live = process.env.THRESH_LIVE_E2E === "1";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:4173", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -- --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      env: { VITE_INVENTORY_API_URL: "http://127.0.0.1:3102/api" },
    },
    ...(live ? [{
      command: "npm --prefix ../backend run start",
      url: "http://127.0.0.1:3102",
      env: {
        PORT: "3102",
        THRESH_APP_ORIGIN: "http://127.0.0.1:4173",
        MONGODB_URI: process.env.THRESH_BROWSER_DB ?? "mongodb://127.0.0.1:27017/thresh_browser_test",
        INVENTORY_ACTORS_JSON: JSON.stringify([
          { id: "browser-warehouse", role: "warehouse", workspaceId: "browser", tokenHash: createHash("sha256").update("0".repeat(64)).digest("hex") },
          { id: "browser-verifier", role: "verifier", workspaceId: "browser", tokenHash: createHash("sha256").update("1".repeat(64)).digest("hex"), walletAddress: "GBXFXNDLV4LSWA4VB7YIL5GBD7BVNR22SGBTDKMO2SBZZHDXSKZYCP7L" },
          { id: "browser-lender", role: "lender", workspaceId: "browser", tokenHash: createHash("sha256").update("2".repeat(64)).digest("hex") },
          { id: "browser-outsider", role: "lender", workspaceId: "outside", tokenHash: createHash("sha256").update("3".repeat(64)).digest("hex") },
        ]),
      },
    }] : []),
  ],
});
