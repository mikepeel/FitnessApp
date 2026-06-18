// @ts-check
const { defineConfig, devices } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// Load test credentials from .env.test.local (gitignored)
const testEnvPath = path.join(__dirname, ".env.test.local");
if (fs.existsSync(testEnvPath)) {
  fs.readFileSync(testEnvPath, "utf8")
    .split("\n")
    .forEach((line) => {
      const m = line.match(/^\s*([^#\s][^=]*?)\s*=\s*(.*?)\s*$/);
      if (m && !process.env[m[1]])
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    });
}

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 60000,
  expect: { timeout: 10000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    // Defaults to the live deploy (what CI / the normal suite targets). Override with
    // E2E_BASE_URL=http://localhost:3000 to run against a local dev server — needed for
    // mutation-checks, where a guarded line is reverted locally and the test must fail.
    baseURL: process.env.E2E_BASE_URL || "https://fitness-app-iota-pied.vercel.app",
    viewport: { width: 390, height: 844 },
    browserName: "chromium",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.js/,
      use: { browserName: "chromium", viewport: { width: 390, height: 844 } },
    },
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        storageState: "tests/.auth/state.json",
      },
      dependencies: ["setup"],
    },
  ],
});
