/**
 * MODULE 5B — Staff: Mis Ganancias (My Earnings)
 * Runs with staff auth state
 */
import { test, expect } from '@playwright/test';

test.describe('Module 5B — Staff: My Earnings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-earnings');
    await page.waitForLoadState('networkidle');
  });

  test('5B.1 My Earnings page renders', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('5B.2 Date selector visible', async ({ page }) => {
    const hoyBtn = page.locator('button', { hasText: 'Hoy' });
    const ayerBtn = page.locator('button', { hasText: 'Ayer' });
    await expect(hoyBtn).toBeVisible();
    await expect(ayerBtn).toBeVisible();
  });

  test('5B.3 Shows commission-related content', async ({ page }) => {
    const mainText = await page.locator('main').textContent() || '';
    // Should show commission or earnings info
    expect(mainText).toMatch(/Comisi[oó]n|Ganancia|Ingreso|Bs\./i);
  });

  test('5B.4 Clicking Ayer loads previous day', async ({ page }) => {
    const ayerBtn = page.locator('button', { hasText: 'Ayer' });
    await ayerBtn.click();
    await page.waitForTimeout(1000);

    // Page should still render without errors
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
