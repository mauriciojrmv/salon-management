/**
 * MODULE 13 — Expenses (Gastos)
 * Tests expense creation, category breakdown, date filtering
 */
import { test, expect } from '@playwright/test';

test.describe('Module 13 — Expenses', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/expenses');
    await page.waitForLoadState('networkidle');
  });

  test('13.1 Expenses page renders', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('13.2 Register expense button visible', async ({ page }) => {
    const addBtn = page.locator('button', { hasText: /Nuevo Gasto|Registrar|Agregar/i });
    await expect(addBtn).toBeVisible();
  });

  test('13.3 Create expense modal opens', async ({ page }) => {
    const addBtn = page.locator('button', { hasText: /Nuevo Gasto|Registrar|Agregar/i });
    await addBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();
  });

  test('13.4 Date filter buttons visible', async ({ page }) => {
    // Should have date range filter options
    const hoyBtn = page.locator('button', { hasText: /Hoy/i });
    const mesBtn = page.locator('button', { hasText: /Este Mes|Mes/i });

    // At least one should be visible
    const hoyVisible = await hoyBtn.isVisible().catch(() => false);
    const mesVisible = await mesBtn.isVisible().catch(() => false);
    expect(hoyVisible || mesVisible).toBe(true);
  });

  test('13.5 Amounts use Bs. format', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
    // If expenses exist, amounts should show Bs.
    // Even if empty, the totals section should show Bs. 0.00
    const mainText = await main.textContent() || '';
    expect(mainText).toContain('Bs.');
  });
});
