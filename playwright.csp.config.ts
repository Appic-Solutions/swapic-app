// The CSP check only: the built out/ served with its own headers (scripts/serve-out.mjs).
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e', testMatch: 'csp.spec.ts', workers: 1, timeout: 90_000,
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3200' },
  webServer: { command: 'node scripts/serve-out.mjs', url: 'http://localhost:3200', reuseExistingServer: false },
});
