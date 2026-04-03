/**
 * Shared login helper for e2e tests.
 * Each role logs in once and saves browser state (cookies/storage)
 * so subsequent tests don't need to log in again.
 */
import { type Page, expect } from '@playwright/test';

export const CREDENTIALS = {
  admin: { email: 'admin@salon.com', password: '21090411' },
  manager: { email: 'gerente@salon.com', password: '21090411' },
  staff: { email: 'trabajador@salon.com', password: '21090411' },
} as const;

export type Role = keyof typeof CREDENTIALS;

export async function login(page: Page, role: Role) {
  const creds = CREDENTIALS[role];
  await page.goto('/auth');
  await page.waitForLoadState('networkidle');

  // Fill login form
  await page.fill('input[type="email"]', creds.email);
  await page.fill('input[type="password"]', creds.password);

  // Click login button
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard (or my-work for staff)
  await page.waitForURL(/\/(dashboard|my-work)/, { timeout: 15000 });

  // Verify we're logged in — main content loaded
  await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
}

export async function logout(page: Page) {
  // Click logout button in sidebar
  const logoutBtn = page.locator('button', { hasText: /Cerrar Sesión|←/ });
  if (await logoutBtn.isVisible()) {
    await logoutBtn.click();
    await page.waitForURL('/auth', { timeout: 10000 });
  }
}
