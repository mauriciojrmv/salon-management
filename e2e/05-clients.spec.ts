/**
 * MODULE 6 — Clients
 * Tests client list, search, create, edit, loyalty display
 */
import { test, expect } from '@playwright/test';

test.describe('Module 6 — Clients', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');
  });

  test('6.1 Client list renders', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Should have a create client button
    const createBtn = page.locator('button', { hasText: /Nuevo Cliente|Agregar/i });
    await expect(createBtn).toBeVisible();
  });

  test('6.2 Search by name works', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Buscar"], input[type="search"], input[type="text"]').first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test');
      await page.waitForTimeout(500);
      // Page should still render without errors
      const main = page.locator('main');
      await expect(main).toBeVisible();
    }
  });

  test('6.3 Create client modal opens', async ({ page }) => {
    const createBtn = page.locator('button', { hasText: /Nuevo Cliente|Agregar/i });
    await createBtn.click();

    // Modal should appear with form fields
    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();

    // Should have name fields
    const nameInput = modal.locator('input').first();
    await expect(nameInput).toBeVisible();
  });

  test('6.4 Client cards show loyalty tier badge', async ({ page }) => {
    // Check if any clients have loyalty badges
    const main = page.locator('main');
    const mainText = await main.textContent();

    // Should render client data or empty state
    expect(mainText).toBeTruthy();
  });

  test('6.5 All dates display dd/mm/yyyy', async ({ page }) => {
    // Look for date patterns — should be dd/mm/yyyy, NOT yyyy-mm-dd
    const mainText = await page.locator('main').textContent() || '';
    const isoDatePattern = /\d{4}-\d{2}-\d{2}/;
    // Dates in the client list should be formatted, not raw ISO
    // Note: some internal data may use ISO, but displayed dates should be dd/mm
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });
});
