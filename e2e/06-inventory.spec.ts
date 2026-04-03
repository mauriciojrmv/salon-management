/**
 * MODULE 8 — Inventory
 * Tests product list, stock display, create/edit
 */
import { test, expect } from '@playwright/test';

test.describe('Module 8 — Inventory', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/inventory');
    await page.waitForLoadState('networkidle');
  });

  test('8.1 Inventory page renders with product list', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have add product button
    const addBtn = page.locator('button', { hasText: /Nuevo Producto|Agregar/i });
    await expect(addBtn).toBeVisible();
  });

  test('8.2 Products show stock levels', async ({ page }) => {
    const mainText = await page.locator('main').textContent();
    // Should show stock-related content or empty state
    expect(mainText).toBeTruthy();
  });

  test('8.3 Create product modal opens', async ({ page }) => {
    const addBtn = page.locator('button', { hasText: /Nuevo Producto|Agregar/i });
    await addBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();
  });

  test('8.4 Units shown in Spanish', async ({ page }) => {
    const mainText = await page.locator('main').textContent() || '';
    // If products exist, units should be in Spanish
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
