/**
 * MODULE 11 — Reports (Admin/Manager only)
 * Tests date range, profitability, payroll, export/print
 */
import { test, expect } from '@playwright/test';

test.describe('Module 11 — Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
  });

  test('11.1 Reports page renders', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('11.2 Date range selector visible', async ({ page }) => {
    // Should have date inputs for range selection
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('11.3 Export CSV button visible', async ({ page }) => {
    const exportBtn = page.locator('button', { hasText: /Exportar|CSV/i });
    await expect(exportBtn).toBeVisible();
  });

  test('11.4 Print button visible', async ({ page }) => {
    const printBtn = page.locator('button', { hasText: /Imprimir/i });
    await expect(printBtn).toBeVisible();
  });

  test('11.5 Report shows summary totals', async ({ page }) => {
    const mainText = await page.locator('main').textContent() || '';
    // Should show financial summary labels
    expect(mainText).toMatch(/Ingreso|Total|Planilla|Ganancia/i);
  });
});
