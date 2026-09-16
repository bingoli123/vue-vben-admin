import process from 'node:process';

import { expect, test } from '@playwright/test';

/** 只连接独立 _test 数据库对应服务；已发号规则不可删除，由验收环境生命周期统一回收。 */
test('规则维护与真实取号保持连续进度，冲突后重新读取', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const username = process.env.XK_NUMBERING_E2E_USER;
  const password = process.env.XK_NUMBERING_E2E_PASSWORD;
  if (!username || !password) throw new Error('请提供独立测试账号环境变量');
  const challengeResponse = page.waitForResponse((r) =>
    r.url().endsWith('/auth/captcha'),
  );
  await page.goto('/auth/login');
  const challenge = await challengeResponse;
  expect(challenge.ok()).toBeTruthy();
  await page.getByPlaceholder('请输入账号').fill(username);
  await page.getByPlaceholder('请输入密码').fill(password);
  const slider = page.locator('[name="captcha"]');
  const handle = page.locator('[name="captcha-action"]');
  await expect(handle).toBeVisible();
  const trackBox = await slider.boundingBox();
  const handleBox = await handle.boundingBox();
  if (!trackBox || !handleBox) throw new Error('未找到滑块');
  const startX = handleBox.x + handleBox.width / 2;
  const y = handleBox.y + handleBox.height / 2;
  const endX = trackBox.x + trackBox.width - handleBox.width / 2;
  const captchaResponse = page.waitForResponse(
    (r) => r.url().endsWith('/auth/captcha/verify'),
    { timeout: 15_000 },
  );
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let step = 1; step <= 20; step++) {
    await page.mouse.move(startX + ((endX - startX) * step) / 20, y);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  const verified = await captchaResponse;
  expect(verified.ok()).toBeTruthy();
  const loginResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && r.url().endsWith('/api/auth/login'),
  );
  await page.getByRole('button', { name: 'login', exact: true }).click();
  const response = await loginResponse;
  const login = await response.json();
  const headers = { Authorization: `Bearer ${login.data.token}` };
  await expect(page).not.toHaveURL(/\/auth\/login/);
  const menus = await page.request.get('/api/auth/menus', { headers });
  type Menu = { children?: Menu[]; id: string; url?: string };
  const flatten = (nodes: Menu[]): Menu[] =>
    nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
  const navigation = await menus.json();
  const menu = flatten(navigation.data).find(
    (n) => n.url === '/admin/code-rules',
  );
  if (!menu) throw new Error('迁移应提供编码管理菜单');
  await page.goto(`/menus/${menu.id}`);

  const unique = `numbering-e2e-${Date.now()}`;
  const dialog = page.getByRole('dialog');
  const save = () => dialog.getByRole('button', { name: /^确\s*认$/ }).click();
  const cancel = () =>
    dialog.getByRole('button', { name: /^取\s*消$/ }).click();
  const create = async (code: string) => {
    await page.getByRole('button', { name: '新增规则', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: /^确\s*认$/ }),
    ).toBeVisible();
    await dialog.getByRole('textbox').nth(0).fill('编码验收规则');
    await dialog.getByRole('textbox').nth(1).fill(code);
    await dialog.getByRole('textbox').nth(2).fill('OD');
    await expect(dialog.getByRole('spinbutton')).toHaveValue('6');
    await save();
    await expect(dialog).not.toBeVisible();
  };
  const filter = async (code: string) => {
    await page.getByRole('textbox').nth(1).fill(code);
    await page.getByRole('button', { name: /^搜\s*索$/ }).click();
  };
  await create(unique);
  await filter(unique);
  const row = page.locator('.vxe-body--row').filter({ hasText: unique });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('未发号');
  const listing = await page.request.get('/api/admin/code-rules', {
    headers,
    params: { code: unique },
  });
  const listed = await listing.json();
  const rule = listed.data.records.find(
    (r: { code: string }) => r.code === unique,
  );
  expect(rule).toBeTruthy();
  const issue = async () => {
    const response = await page.request.post(
      `/api/admin/code-rules/${rule.id}/issue`,
      { headers },
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    return body.data;
  };
  for (let i = 0; i < 123; i++) await issue();
  await filter(unique);
  await expect(row).toContainText('000123');
  await row.getByText('详情', { exact: true }).click();
  await expect(dialog.getByText('000123', { exact: true })).toBeVisible();
  await dialog.getByRole('button').first().click();
  await expect(dialog).not.toBeVisible();
  await row.getByText('编辑', { exact: true }).click();
  await expect(dialog.getByRole('spinbutton')).toHaveValue('6');
  await dialog.getByRole('textbox').nth(1).fill(`${unique}-renamed`);
  await dialog.getByRole('textbox').nth(2).fill('NEW');
  await dialog.getByRole('spinbutton').fill('8');
  await save();
  await expect(dialog).not.toBeVisible();
  await expect(row).toContainText('00000123');
  const issued = await issue();
  expect(issued.number).toBe('NEW00000124');
  await filter(unique);
  await expect(row).toContainText('00000124');
  // 表单打开后发生真实取号，使保存携带的旧版本失效；失败不能关闭或报告成功。
  await row.getByText('编辑', { exact: true }).click();
  await expect(dialog.getByRole('spinbutton')).toHaveValue('8');
  await issue();
  await dialog.getByRole('textbox').nth(0).fill('旧版本不应覆盖');
  const conflict = page.waitForResponse(
    (r) =>
      r.request().method() === 'PUT' &&
      r.url().endsWith(`/code-rules/${rule.id}`),
  );
  await save();
  const rejected = await conflict;
  expect(rejected.status()).toBe(409);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^确\s*认$/ })).toHaveCount(
    0,
  );
  await cancel();
  await expect(dialog).not.toBeVisible();
  await row.getByText('编辑', { exact: true }).click();
  await expect(dialog).toContainText('00000125');
  await expect(dialog.getByRole('spinbutton')).toHaveAttribute(
    'aria-valuemin',
    '8',
  );
  await cancel();
  await expect(dialog).not.toBeVisible();
  await filter(`no-such-${unique}`);
  await expect(page.locator('.vxe-body--row')).toHaveCount(0);
  await filter(unique);
  await expect(row).toContainText('00000125');
  await expect(
    page.getByRole('button', { name: '取号', exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath('continuous-progress.png'),
    fullPage: true,
  });
  // 单独创建未使用规则验证编辑缩短及删除，绝不删除其他行。
  const unused = `${unique}-unused`;
  await create(unused);
  await filter(unused);
  const unusedRow = page.locator('.vxe-body--row').filter({ hasText: unused });
  await expect(unusedRow).toHaveCount(1);
  await unusedRow.getByText('编辑', { exact: true }).click();
  await expect(dialog.getByRole('spinbutton')).toHaveValue('6');
  await dialog.getByRole('spinbutton').fill('2');
  await save();
  await expect(dialog).not.toBeVisible();
  await expect(unusedRow.getByText('00', { exact: true })).toBeVisible();
  await unusedRow.getByRole('button').last().click();
  await page.getByText('删除', { exact: true }).click();
  await page
    .getByRole('dialog', { name: '删除', exact: true })
    .getByRole('button', { name: '确认', exact: true })
    .click();
  await expect(unusedRow).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.request.post('/api/auth/logout', { headers });
});
