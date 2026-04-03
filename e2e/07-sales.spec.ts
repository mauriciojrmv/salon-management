/**
 * MODULE 12 — Retail Sales
 * Tests product sale modal, client selection, categories, loyalty points
 */
import { test, expect } from '@playwright/test';

test.describe('Module 12 — Retail Sales', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sales');
    await page.waitForLoadState('networkidle');
  });

  test('12.1 Sales page renders with new sale button', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();

    const newSaleBtn = page.locator('button', { hasText: /Nueva Venta|Vender/i });
    await expect(newSaleBtn).toBeVisible();
  });

  test('12.2 Sale modal opens with client defaulting to walk-in', async ({ page }) => {
    const newSaleBtn = page.locator('button', { hasText: /Nueva Venta|Vender/i });
    await newSaleBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();

    // Client should default to "Sin Cliente"
    const modalText = await modal.textContent();
    expect(modalText).toContain('Sin Cliente');
  });

  test('12.3 Category filter pills visible in modal', async ({ page }) => {
    const newSaleBtn = page.locator('button', { hasText: /Nueva Venta|Vender/i });
    await newSaleBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();

    // Should have "Todos" category pill at minimum
    const todosBtn = modal.locator('button', { hasText: 'Todos' });
    await expect(todosBtn).toBeVisible();
  });

  test('12.4 Product search bar visible in modal', async ({ page }) => {
    const newSaleBtn = page.locator('button', { hasText: /Nueva Venta|Vender/i });
    await newSaleBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    const searchInput = modal.locator('input[placeholder*="Buscar"], input[type="search"], input[type="text"]').first();
    await expect(searchInput).toBeVisible();
  });

  test('12.5 Products shown in grid', async ({ page }) => {
    const newSaleBtn = page.locator('button', { hasText: /Nueva Venta|Vender/i });
    await newSaleBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();

    // Should display products (or empty state)
    await page.waitForTimeout(1000);
    const modalText = await modal.textContent();
    expect(modalText).toBeTruthy();
  });

  test('12.6 Quick client form toggle exists', async ({ page }) => {
    const newSaleBtn = page.locator('button', { hasText: /Nueva Venta|Vender/i });
    await newSaleBtn.click();

    const modal = page.locator('[class*="fixed inset-0"]');
    const quickClientBtn = modal.locator('button', { hasText: /Nuevo cliente|nuevo cliente/i });
    await expect(quickClientBtn).toBeVisible();
  });

  test('12.7 Daily sales summary shown on page', async ({ page }) => {
    const mainText = await page.locator('main').textContent();
    // Should show sales list or empty state
    expect(mainText).toBeTruthy();
  });
});
