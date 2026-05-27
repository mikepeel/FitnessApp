// @ts-check
const { test: setup, expect } = require("@playwright/test");
const path = require("path");
const AUTH_FILE = path.join(__dirname, ".auth/state.json");

setup("authenticate as test user", async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "TEST_EMAIL and TEST_PASSWORD must be set in .env.test.local"
    );
  }

  await page.goto("/");
  await expect(page.getByPlaceholder("Email")).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for the main app to load (nav bar visible = logged in)
  await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({
    timeout: 20000,
  });

  await page.context().storageState({ path: AUTH_FILE });
});
