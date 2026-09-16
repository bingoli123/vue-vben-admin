import type { Page } from '@playwright/test';

import process from 'node:process';

import { expect, test } from '@playwright/test';

/** 仅针对独立验收库，管理员和普通用户由环境提供；人员无删除API，随专属环境回收。 */
async function login(page: Page, username: string, password: string) {
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

  await expect(page).not.toHaveURL(/\/auth\/login/);
  return { Authorization: `Bearer ${login.data.token}` };
}
function credentials() {
  const username = process.env.XK_PERSONNEL_E2E_USER;
  const password = process.env.XK_PERSONNEL_E2E_PASSWORD;
  if (!username || !password) throw new Error('请提供独立测试账号环境变量');
  return { username, password };
}
async function openPersonnel(page: Page, headers: Record<string, string>) {
  const response = await page.request.get('/api/auth/menus', { headers });
  const body = await response.json();
  type Menu = { id: string; url?: string; children?: Menu[] };
  const flatten = (nodes: Menu[]): Menu[] =>
    nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
  const menu = flatten(body.data).find((n) => n.url === '/cadre/personnel');
  if (!menu) throw new Error('缺少人员菜单');
  await page.goto(`/menus/${menu.id}`);
}

test('管理员维护独立人员，自动编号、简拼、重复手机修正及空值往返', async ({
  page,
}, info) => {
  const { username, password } = credentials();
  const headers = await login(page, username, password);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await openPersonnel(page, headers);
  const outside = await page.request.post('/api/cadre/personnel', {
    headers,
    data: {
      unitId: process.env.XK_PERSONNEL_E2E_UNIT_B,
      name: 'B单位越界样本',
    },
  });
  expect(outside.ok()).toBeTruthy();
  const name = `张三验收${Date.now()}`;
  const dialog = page.getByRole('dialog');
  const confirm = () =>
    dialog.getByRole('button', { name: /^确\s*认$/ }).click();
  const create = async () => {
    await page.getByRole('button', { name: '新增人员', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: /^确\s*认$/ }),
    ).toBeVisible();
    await expect(dialog.getByPlaceholder('保存后自动生成')).toHaveAttribute(
      'readonly',
    );
    await dialog.getByRole('combobox').click();
    await page.getByText('人员验收A单位', { exact: true }).last().click();
    await dialog.getByPlaceholder('请输入人员名称').fill(name);
    await dialog.getByPlaceholder('选填，独立于人员编号').click();
    await expect(
      dialog.getByPlaceholder('自动生成，可按实际读音修正'),
    ).toHaveValue(/^ZSYS/);
  };
  const search = async () => {
    await page.getByPlaceholder('搜索人员名称').fill(name);
    await page.getByRole('button', { name: /^搜\s*索$/ }).click();
  };
  await create();
  await confirm();
  await expect(dialog).not.toBeVisible();
  await search();
  const rows = page.locator('.vxe-body--row').filter({ hasText: name });
  await expect(rows).toHaveCount(1);
  const listed = await page.request.get('/api/cadre/personnel', {
    headers,
    params: { name },
  });
  const list = await listed.json();
  const first = list.data.records[0];
  expect(first.number).toMatch(/^RY[0-9]{6}$/);
  expect(first.phone).toBeNull();
  expect(first.sortOrder).toBeNull();
  await page.getByRole('button', { name: '详情', exact: true }).click();
  await expect(dialog.getByText(first.number, { exact: true })).toBeVisible();
  await expect(dialog).toContainText('未配置');
  await dialog.getByRole('button').first().click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole('button', { name: /^编\s*辑$/ }).click();
  await expect(dialog.getByRole('button', { name: /^确\s*认$/ })).toBeVisible();
  await expect(dialog.getByPlaceholder('保存后自动生成')).toHaveValue(
    first.number,
  );
  await dialog.getByPlaceholder('自动生成，可按实际读音修正').fill('CUSTOM');
  await dialog.getByPlaceholder('选填，独立于人员编号').fill('重复工号');
  await dialog
    .getByPlaceholder('选填，填写后不能与其他人员重复')
    .fill('13800005505');
  await dialog.getByPlaceholder('请输入职务（选填）').fill('主任');
  await dialog.getByRole('spinbutton').fill('0');
  await confirm();
  await expect(dialog).not.toBeVisible();
  await expect(rows).toContainText('CUSTOM');
  await create();
  await dialog.getByPlaceholder('选填，独立于人员编号').fill('重复工号');
  await dialog
    .getByPlaceholder('选填，填写后不能与其他人员重复')
    .fill('13800005505');
  const conflict = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' && r.url().endsWith('/cadre/personnel'),
  );
  await confirm();
  const rejected = await conflict;
  expect(rejected.status()).toBe(409);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: /^确\s*认$/ })).toBeVisible();
  await dialog.getByPlaceholder('选填，填写后不能与其他人员重复').fill('');
  await confirm();
  await expect(dialog).not.toBeVisible();
  await expect(rows).toHaveCount(2);
  await page.getByPlaceholder('搜索人员编号').fill(first.number);
  await page.getByRole('button', { name: /^搜\s*索$/ }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: /^编\s*辑$/ }).click();
  await expect(
    dialog.getByPlaceholder('自动生成，可按实际读音修正'),
  ).toHaveValue('CUSTOM');
  await expect(dialog.getByRole('spinbutton')).toHaveValue('0');
  await dialog.getByPlaceholder('选填，独立于人员编号').fill('');
  await dialog.getByPlaceholder('选填，填写后不能与其他人员重复').fill('');
  await dialog.getByPlaceholder('请输入职务（选填）').fill('');
  await dialog.getByRole('spinbutton').fill('');
  await confirm();
  await expect(dialog).not.toBeVisible();
  const read = await page.request.get(`/api/cadre/personnel/${first.id}`, {
    headers,
  });
  const current = await read.json();
  for (const key of ['phone', 'employeeNo', 'position', 'sortOrder'])
    expect(current.data[key]).toBeNull();
  expect(current.data.number).toBe(first.number);
  expect(current.data.initials).toBe('CUSTOM');
  await page.getByPlaceholder('搜索名称简拼').fill('custom');
  await page.getByRole('button', { name: /^搜\s*索$/ }).click();
  await expect(rows).toHaveCount(1);
  await page.screenshot({
    path: info.outputPath('personnel-maintenance.png'),
    fullPage: true,
  });
  await expect(
    page.getByRole('button', { name: '删除', exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
  await page.request.post('/api/auth/logout', { headers });
});

test('查询用户只看到授权单位且没有新增编辑入口', async ({ page }, info) => {
  const { password } = credentials();
  const username = process.env.XK_PERSONNEL_E2E_READER;
  if (!username) throw new Error('缺少只读测试账号');
  const headers = await login(page, username, password);
  await openPersonnel(page, headers);
  await expect(
    page.getByText('人员验收A单位', { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText('人员验收B单位', { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: '新增人员', exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^编\s*辑$/ })).toHaveCount(0);
  const options = await page.request.get('/api/cadre/personnel/units', {
    headers,
  });
  const body = await options.json();
  expect(
    body.data.every((u: { name: string }) => u.name === '人员验收A单位'),
  ).toBe(true);
  await expect(page.getByText('B单位越界样本', { exact: true })).toHaveCount(0);
  const hidden = await page.request.get('/api/cadre/personnel', {
    headers,
    params: { name: 'B单位越界样本' },
  });
  const hiddenBody = await hidden.json();
  expect(hiddenBody.data.total).toBe(0);
  await page.screenshot({
    path: info.outputPath('personnel-reader.png'),
    fullPage: true,
  });
  await page.request.post('/api/auth/logout', { headers });
});
