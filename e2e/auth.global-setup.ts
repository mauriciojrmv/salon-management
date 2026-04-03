/**
 * Global auth setup — runs ONCE before all test suites.
 * Logs in as each role, saves browser storage state to e2e/.auth/<role>.json
 * so subsequent tests skip the login flow entirely.
 */
import { test as setup, expect } from '@playwright/test';
import { CREDENTIALS, type Role, login } from './auth.setup';
import fs from 'fs';

const authDir = 'e2e/.auth';

// Ensure .auth directory exists
setup.beforeAll(() => {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
});

for (const role of Object.keys(CREDENTIALS) as Role[]) {
  setup(`authenticate as ${role}`, async ({ page }) => {
    await login(page, role);

    // Verify we landed on the expected page
    await expect(page.locator('main')).toBeVisible({ timeout: 10000 });

    // Save signed-in state
    await page.context().storageState({ path: `${authDir}/${role}.json` });
  });
}
