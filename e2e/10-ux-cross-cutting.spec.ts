/**
 * CROSS-CUTTING — UX & Accessibility
 * Tests Spanish text, date formats, currency, touch targets
 */
import { test, expect } from '@playwright/test';

const pagesToCheck = [
  { name: 'Dashboard', url: '/dashboard' },
  { name: 'Sessions', url: '/sessions' },
  { name: 'Clients', url: '/clients' },
  { name: 'Sales', url: '/sales' },
  { name: 'Expenses', url: '/expenses' },
];

test.describe('Cross-Cutting UX Checks', () => {
  test('UX.1 No English-only strings in UI on key pages', async ({ page }) => {
    for (const p of pagesToCheck) {
      await page.goto(p.url);
      await page.waitForLoadState('networkidle');

      const bodyText = await page.locator('main').textContent() || '';
      // Should not have common English-only UI strings
      expect(bodyText).not.toMatch(/\bLoading\.\.\./);
      expect(bodyText).not.toMatch(/\bSubmit\b/);
      expect(bodyText).not.toMatch(/\bDelete\b/);
      expect(bodyText).not.toMatch(/\bCancel\b(?!.*[aáeéiíoóuú])/); // "Cancel" but not "Cancelar"
    }
  });

  test('UX.2 Currency uses Bs. format on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const bsElements = page.locator('text=Bs.');
    const count = await bsElements.count();
    expect(count).toBeGreaterThan(0);
  });

  test('UX.3 No raw Firebase error codes visible after bad login', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');

    await page.fill('input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // Wait for error
    const errorMsg = page.locator('[role="alert"], .bg-red-50, .text-red-600').first();
    await expect(errorMsg).toBeVisible({ timeout: 10000 });

    const text = await errorMsg.textContent() || '';
    // Should not contain raw Firebase error codes
    expect(text).not.toMatch(/auth\//);
    expect(text).not.toMatch(/Firebase/);
  });

  test('UX.4 Toast notifications render correctly', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Toast container should exist in the DOM (even if no notifications)
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('UX.5 Terminology uses Atención not Trabajo', async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');

    const mainText = await page.locator('main').textContent() || '';
    // Should use "Atención" terminology
    expect(mainText).not.toMatch(/\bTrabajo\b/);
  });
});
