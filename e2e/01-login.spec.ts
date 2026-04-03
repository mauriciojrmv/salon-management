/**
 * MODULE 1 — Login
 * Tests login flow for all 3 roles + error handling
 */
import { test, expect } from '@playwright/test';
import { CREDENTIALS, login } from './auth.setup';

test.describe('Module 1 — Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
  });

  test('1.1 Login page renders correctly', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('1.2 No self-registration option visible', async ({ page }) => {
    // Should NOT have register/create account links
    const pageText = await page.textContent('body');
    expect(pageText).not.toMatch(/registr|crear cuenta|sign up/i);
  });

  test('1.3 Wrong email shows Spanish error', async ({ page }) => {
    await page.fill('input[type="email"]', 'wrong@wrong.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Wait for error toast/message
    const errorMsg = page.locator('[role="alert"], .bg-red-50, .text-red-600').first();
    await expect(errorMsg).toBeVisible({ timeout: 10000 });

    // Should be in Spanish, not raw Firebase
    const text = await errorMsg.textContent();
    expect(text).not.toMatch(/auth\//); // No Firebase error codes
  });

  test('1.4 Admin login redirects to dashboard', async ({ page }) => {
    await login(page, 'admin');
    expect(page.url()).toContain('/dashboard');
  });

  test('1.5 Manager login redirects to dashboard', async ({ page }) => {
    await login(page, 'manager');
    expect(page.url()).toContain('/dashboard');
  });

  test('1.6 Staff login redirects correctly', async ({ page }) => {
    await login(page, 'staff');
    // Staff may go to dashboard or my-work depending on default route
    expect(page.url()).toMatch(/\/(dashboard|my-work)/);
  });

  test('1.7 Logout returns to login', async ({ page }) => {
    await login(page, 'admin');

    // Open mobile menu if needed, then click logout
    const logoutBtn = page.locator('button', { hasText: /Cerrar Sesión/ });
    if (!(await logoutBtn.isVisible())) {
      // Try opening mobile hamburger menu
      const hamburger = page.locator('button', { hasText: '☰' });
      if (await hamburger.isVisible()) await hamburger.click();
    }
    await logoutBtn.click();
    await page.waitForURL('/auth', { timeout: 10000 });
  });
});
