/**
 * MODULE 2 — Navigation & Sidebar
 * Tests sidebar rendering, group labels, and role-based visibility
 */
import { test, expect } from '@playwright/test';

test.describe('Module 2 — Navigation & Sidebar', () => {
  test('2.1 Sidebar renders with group labels', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Desktop sidebar should be visible
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Check group labels exist
    const navText = await sidebar.textContent();
    expect(navText).toContain('Operaciones');
    expect(navText).toContain('Gestión');
  });

  test('2.2 Admin sees all nav sections including Sistema', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside').first();
    const navText = await sidebar.textContent();

    // Admin should see Sistema group
    expect(navText).toContain('Sistema');
    // And specific admin-only items
    expect(navText).toContain('Usuarios');
    expect(navText).toContain('Sucursales');
  });

  test('2.3 Nav links navigate to correct pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Click on Clients link
    await page.click('a[href="/clients"]');
    await page.waitForURL('/clients');
    expect(page.url()).toContain('/clients');

    // Click on Sessions link
    await page.click('a[href="/sessions"]');
    await page.waitForURL('/sessions');
    expect(page.url()).toContain('/sessions');
  });

  test('2.4 Active nav item is highlighted', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Dashboard link should have active styling (bg-blue-600)
    const dashboardLink = page.locator('a[href="/dashboard"]');
    await expect(dashboardLink).toHaveClass(/bg-blue-600/);
  });

  test('2.5 User info and role badge shown in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside').first();
    const sidebarText = await sidebar.textContent();

    // Should show role badge
    expect(sidebarText).toMatch(/Admin|Administrador/i);
  });

  test('2.6 Logout button visible in sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const logoutBtn = page.locator('aside button', { hasText: /Cerrar Sesión/ });
    await expect(logoutBtn).toBeVisible();
  });
});
