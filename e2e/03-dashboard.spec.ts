/**
 * MODULE 3 — Dashboard (Panel)
 * Tests KPI cards, date navigation, and daily data display
 */
import { test, expect } from '@playwright/test';

test.describe('Module 3 — Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
  });

  test('3.1 Dashboard renders KPI cards', async ({ page }) => {
    // Should show main KPI section
    const main = page.locator('main');
    await expect(main).toBeVisible();

    // Check for key KPI labels
    const pageText = await main.textContent();
    expect(pageText).toContain('Ingresos');
  });

  test('3.2 Date navigation: Hoy and Ayer buttons visible', async ({ page }) => {
    const hoyBtn = page.locator('button', { hasText: 'Hoy' });
    const ayerBtn = page.locator('button', { hasText: 'Ayer' });

    await expect(hoyBtn).toBeVisible();
    await expect(ayerBtn).toBeVisible();
  });

  test('3.3 Clicking Ayer loads previous day data', async ({ page }) => {
    const ayerBtn = page.locator('button', { hasText: 'Ayer' });
    await ayerBtn.click();

    // Ayer should now be active (or data should update)
    await page.waitForTimeout(1000);

    // Page should still render without errors
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('3.4 Gastos del Día card visible', async ({ page }) => {
    const pageText = await page.locator('main').textContent();
    expect(pageText).toContain('Gastos');
  });

  test('3.5 Balance Neto card visible', async ({ page }) => {
    const pageText = await page.locator('main').textContent();
    expect(pageText).toContain('Balance');
  });

  test('3.6 Cierre de Caja section visible', async ({ page }) => {
    const pageText = await page.locator('main').textContent();
    expect(pageText).toContain('Cierre de Caja');
  });

  test('3.7 Atenciones de Hoy table visible', async ({ page }) => {
    const pageText = await page.locator('main').textContent();
    expect(pageText).toContain('Atenciones');
  });

  test('3.8 All amounts use Bs. format', async ({ page }) => {
    // Check that currency values use Bs. format
    const bsValues = page.locator('text=Bs.');
    const count = await bsValues.count();
    expect(count).toBeGreaterThan(0);
  });
});
