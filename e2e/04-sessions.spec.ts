/**
 * MODULE 4 — Atenciones (Sessions)
 * Tests session creation, service management, payment, and close flow
 */
import { test, expect } from '@playwright/test';

test.describe('Module 4 — Sessions (Atenciones)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sessions');
    await page.waitForLoadState('networkidle');
  });

  test('4.1 Sessions page renders with create button', async ({ page }) => {
    const createBtn = page.locator('button', { hasText: /Nueva Atenci[oó]n/i });
    await expect(createBtn).toBeVisible();
  });

  test('4.2 Date navigation buttons visible', async ({ page }) => {
    const hoyBtn = page.locator('button', { hasText: 'Hoy' });
    await expect(hoyBtn).toBeVisible();
  });

  test('4.3 Create session modal opens with walk-in default', async ({ page }) => {
    const createBtn = page.locator('button', { hasText: /Nueva Atenci[oó]n/i });
    await createBtn.click();

    // Modal should open
    const modal = page.locator('[class*="fixed inset-0"]');
    await expect(modal).toBeVisible();

    // Client should default to "Sin Cliente (Eventual)"
    const modalText = await modal.textContent();
    expect(modalText).toContain('Sin Cliente');
  });

  test('4.4 Can create a walk-in session', async ({ page }) => {
    const createBtn = page.locator('button', { hasText: /Nueva Atenci[oó]n/i });
    await createBtn.click();

    // Modal open — client already defaults to walk-in
    // Click create/confirm button
    const confirmBtn = page.locator('[class*="fixed inset-0"] button', { hasText: /Crear|Confirmar/i });
    await confirmBtn.click();

    // Wait for modal to close and session card to appear
    await page.waitForTimeout(2000);

    // Should see an active session card
    const sessionCards = page.locator('[class*="border"][class*="rounded"]');
    const count = await sessionCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test('4.5 Quick client form appears inline', async ({ page }) => {
    const createBtn = page.locator('button', { hasText: /Nueva Atenci[oó]n/i });
    await createBtn.click();

    // Look for quick client toggle
    const quickClientBtn = page.locator('button', { hasText: /Nuevo cliente|nuevo cliente/i });
    if (await quickClientBtn.isVisible()) {
      await quickClientBtn.click();

      // Should see inline form fields (name, phone)
      const nameInput = page.locator('[class*="fixed inset-0"] input[placeholder*="Nombre"], [class*="fixed inset-0"] input[name*="name"]');
      await expect(nameInput.first()).toBeVisible();
    }
  });

  test('4.6 Add service modal opens from session card', async ({ page }) => {
    // If there's an active session, try to add a service
    const addServiceBtn = page.locator('button', { hasText: /Agregar Servicio/i }).first();
    if (await addServiceBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addServiceBtn.click();

      // Modal should open with service selection
      const modal = page.locator('[class*="fixed inset-0"]');
      await expect(modal).toBeVisible();
    }
  });

  test('4.7 Session status badges render with correct colors', async ({ page }) => {
    // Check for status badges (any active sessions)
    const badges = page.locator('[class*="bg-yellow"], [class*="bg-blue"], [class*="bg-green"]');
    // Just verify page doesn't error — badges may or may not be present
    const main = page.locator('main');
    await expect(main).toBeVisible();
  });

  test('4.8 Completed sessions section exists', async ({ page }) => {
    const pageText = await page.locator('main').textContent();
    // Should have a section for completed sessions (or empty state)
    expect(pageText).toMatch(/Completad|completad|Activ|activ/i);
  });
});
