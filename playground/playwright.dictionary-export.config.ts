import process from 'node:process';

import { defineConfig, devices } from '@playwright/test';

/** 字典验收连接独立测试服务；账号从环境注入，禁止记录登录请求或令牌。 */
export default defineConfig({
  testDir: './__tests__/e2e',
  testMatch: 'dictionary-export.spec.ts',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  outputDir: 'node_modules/.e2e/dictionary-export-results',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: process.env.XK_DICTIONARY_E2E_URL || 'http://localhost:5763',
    headless: true,
    actionTimeout: 15_000,
    viewport: { width: 1440, height: 1000 },
    trace: 'off',
    screenshot: 'only-on-failure',
  },
});
