/**
 * MODULE 5 — Staff: Mis Atenciones (My Work)
 * Runs with staff auth state — tests staff-only views
 */
import { test, expect } from '@playwright/test';

test.describe('Module 5 — Staff: My Work', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/my-work');
    await page.waitForLoadState('networkidle');
  });

  test('5.1 My Work page renders for staff', async ({ page }) => {
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('5.2 Shows only staff-specific sections', async ({ page }) => {
    const mainText = await page.locator('main').textContent() || '';
    // Should show "Mis Atenciones" or similar staff heading
    expect(mainText).toMatch(/Atenci[oó]n|Servicio|Disponible/i);
  });

  test('5.3 Staff sidebar shows only Mi Area group', async ({ page }) => {
    const sidebar = page.locator('aside').first();
    const sidebarText = await sidebar.textContent() || '';

    // Staff should see Mi Area
    expect(sidebarText).toContain('Mi');

    // Staff should NOT see Sistema
    expect(sidebarText).not.toContain('Usuarios');
    expect(sidebarText).not.toContain('Sucursales');
  });

  test('5.4 Staff cannot see cancel button on sessions', async ({ page }) => {
    // Cancel/Anular button should NOT be visible for staff
    const cancelBtn = page.locator('button', { hasText: /Anular/i });
    const visible = await cancelBtn.isVisible().catch(() => false);
    expect(visible).toBe(false);
  });

  test('5.5 Date navigation visible', async ({ page }) => {
    const hoyBtn = page.locator('button', { hasText: 'Hoy' });
    await expect(hoyBtn).toBeVisible();
  });
});
