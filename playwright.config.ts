import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  expect: { timeout: 10000 },
  retries: 0,
  reporter: [['html', { open: 'never' }], ['list']],
  use: {
    baseURL: 'http://localhost:3000',
    headless: false,
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
    actionTimeout: 10000,
  },
  // Don't start the dev server automatically — you run it yourself
  webServer: undefined,
  projects: [
    // Setup: login each role and save browser state
    {
      name: 'auth-setup',
      testMatch: /auth\.global-setup\.ts/,
    },
    // Admin tests — depend on auth-setup
    {
      name: 'admin',
      use: {
        browserName: 'chromium',
        storageState: 'e2e/.auth/admin.json',
      },
      dependencies: ['auth-setup'],
      testMatch: /\d+-.*\.spec\.ts/,
      testIgnore: /staff-.*\.spec\.ts/,
    },
    // Staff tests — depend on auth-setup
    {
      name: 'staff',
      use: {
        browserName: 'chromium',
        storageState: 'e2e/.auth/staff.json',
      },
      dependencies: ['auth-setup'],
      testMatch: /staff-.*\.spec\.ts/,
    },
  ],
});
