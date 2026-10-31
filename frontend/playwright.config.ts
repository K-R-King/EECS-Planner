import { defineConfig } from "@playwright/test";

// Browser tests drive the real page against the real backend (only Gemini is mocked, in the tests).
// Locally they reuse servers you already have running and your installed Chrome.
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    baseURL: "http://localhost:3000",
    channel: process.env.CI ? undefined : "chrome",
    permissions: ["clipboard-read", "clipboard-write"],
  },
  webServer: [
    {
      command: "python -m uvicorn backend.main:app --port 8000",
      cwd: "..",
      url: "http://127.0.0.1:8000/courses",
      reuseExistingServer: !process.env.CI,
      env: { GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? "test-key" },
    },
    {
      command: "npm run dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
