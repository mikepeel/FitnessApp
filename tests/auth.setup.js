// @ts-check
const { test: setup, expect } = require("@playwright/test");
const path = require("path");
const AUTH_FILE = path.join(__dirname, ".auth/state.json");

setup("authenticate as test user", async ({ page }) => {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error("TEST_EMAIL and TEST_PASSWORD must be set in .env.test.local");
  }

  await page.goto("/");
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible({ timeout: 15000 });

  await page.getByPlaceholder("you@example.com").fill(email);
  await page.getByPlaceholder("Your password").fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for nav bar (auth succeeded) then wait for plan data to load
  await expect(page.getByRole("button", { name: /Workout/i })).toBeVisible({ timeout: 20000 });

  // Wait for Supabase data to finish — START buttons appear only after plans load
  await expect(page.getByRole("button", { name: "START" }).first()).toBeVisible({ timeout: 15000 });

  await page.context().storageState({ path: AUTH_FILE });
});
