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
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],

  use: {
    baseURL: "https://fitness-app-iota-pied.vercel.app",
    viewport: { width: 390, height: 844 },
    ...devices["iPhone 12"],
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.js/,
    },
    {
      name: "chromium",
      use: {
        ...devices["iPhone 12"],
        storageState: "tests/.auth/state.json",
      },
      dependencies: ["setup"],
    },
  ],
});
