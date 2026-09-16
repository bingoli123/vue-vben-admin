import process from 'node:process';

import { expect, test } from '@playwright/test';

/** 从登录、真实接口到可见表单验收，不 mock 页面组件或业务服务。仅删除本测试创建的字典。 */
test('业务页面消费字典，改名改键删除后保留历史值', async ({
  page,
}, testInfo) => {
  const username = process.env.XK_DICTIONARY_E2E_USER;
  const password = process.env.XK_DICTIONARY_E2E_PASSWORD;
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
  const loginResponse = page.waitForResponse((r) =>
    r.url().endsWith('/auth/login'),
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

  const menuUrl = (url: string) => {
    const found = flatten(navigation.data).find((n) => n.url === url);
    if (!found) throw new Error(`缺少菜单 ${url}`);
    return `/menus/${found.id}`;
  };
  const api = async (method: string, path: string, data?: unknown) => {
    const response = await page.request.fetch(`/api${path}`, {
      method,
      headers,
      data,
    });
    expect(response.ok(), `${method} ${path}`).toBeTruthy();
    const result = await response.json();
    return result.data;
  };
  const readGender = async () => {
    const result = await api('GET', '/auth/profile');
    return result.gender;
  };
  const profile = await api('GET', '/auth/profile');
  const dictionaries = await api('GET', '/admin/dictionaries?type=sys_gender');
  const dictionary = dictionaries.records.find(
    (row: { type: string }) => row.type === 'sys_gender',
  );
  if (!dictionary) throw new Error('缺少初始化性别字典');
  const root = `/admin/dictionaries/${dictionary.id}`;
  const entries = await api('GET', `${root}/items`);
  const male = entries.records.find(
    (row: { value: string }) => row.value === '1',
  );
  const tag = `dict02-${Date.now()}`;
  let unit: undefined | { id: string; version: number };
  const dialog = page.getByRole('dialog');
  const field = (label: string) =>
    page
      .locator(
        `[data-dictionary-type="${label === '性别' ? 'sys_gender' : 'sys_unit_category'}"]`,
      )
      .last();
  const select = async (label: string, text: string) => {
    await field(label).click();
    await page
      .locator('.ant-select-dropdown:visible')
      .getByText(text, { exact: true })
      .click();
  };
  try {
    // 仅改独立测试管理员本人资料，不创建无关登录账号。
    await api('PUT', '/auth/profile', {
      name: tag,
      gender: '222',
      version: profile.version,
    });
    await page.goto(menuUrl('/admin/users'));
    await expect(
      page.locator('.vxe-table--body-wrapper').first(),
    ).toContainText('222');
    await page
      .getByRole('button', { name: /^详\s*情$/ })
      .first()
      .click();
    await expect(dialog).toContainText('222');
    await dialog.getByRole('button').first().click();
    await expect(dialog).not.toBeVisible();
    await page
      .getByRole('button', { name: /^编\s*辑$/ })
      .first()
      .click();
    await expect(dialog).toContainText('222');
    const savedUser = page.waitForResponse(
      (r) =>
        r.request().method() === 'PUT' && /\/admin\/users\/\d+$/.test(r.url()),
    );
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    const savedResponse = await savedUser;
    expect(savedResponse.ok()).toBeTruthy();
    expect(await readGender()).toBe('222');
    await page.goto('/profile');
    await expect(field('性别')).toContainText('222');
    await select('性别', '男');
    await page.getByRole('button', { name: /更新基本信息|保存/ }).click();
    await expect.poll(readGender).toBe('1');

    await api('PUT', `${root}/items/${male.id}`, {
      label: '男性选项新名',
      value: '1',
      sortOrder: 10,
      version: male.version,
    });
    await page.goto(menuUrl('/admin/users'));
    await expect(
      page.locator('.vxe-table--body-wrapper').first(),
    ).toContainText('男性选项新名');
    await page
      .getByRole('button', { name: /^详\s*情$/ })
      .first()
      .click();
    await expect(dialog).toContainText('男性选项新名');
    await dialog.getByRole('button').first().click();
    await select('性别', '男性选项新名');
    await expect(
      page.locator('.vxe-table--body-wrapper').first(),
    ).toContainText(tag);
    await api('PUT', `${root}/items/${male.id}`, {
      label: '男性选项新名',
      value: 'male',
      sortOrder: 10,
      version: male.version + 1,
    });
    await page.goto('/profile');
    await expect(field('性别')).toContainText('1');
    await page.getByRole('button', { name: /更新基本信息|保存/ }).click();
    expect(await readGender()).toBe('1');
    await select('性别', '男性选项新名');
    await page.getByRole('button', { name: /更新基本信息|保存/ }).click();
    await expect.poll(readGender).toBe('male');
    await api('DELETE', `${root}/items/${male.id}?version=${male.version + 2}`);
    await page.reload();
    await expect(field('性别')).toContainText('male');
    await page.getByRole('button', { name: /更新基本信息|保存/ }).click();
    expect(await readGender()).toBe('male');
    await page.screenshot({
      path: testInfo.outputPath('unknown-profile.png'),
      fullPage: true,
    });

    unit = await api('POST', '/admin/units', {
      code: tag,
      name: tag,
      category: '222',
      sortOrder: 0,
      enabled: true,
    });
    await page.goto(menuUrl('/admin/units'));
    const unitRow = page.locator('.vxe-body--row').filter({ hasText: tag });
    await expect(unitRow).toContainText('222');
    const rowKey = await unitRow.getAttribute('rowid');
    if (!rowKey) throw new Error('缺少单位行标识');
    const unitActions = page.locator(`.vxe-body--row[rowid="${rowKey}"]`);
    await unitActions.getByRole('button', { name: /^编\s*辑$/ }).click();
    await expect(dialog).toContainText('222');
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    await expect(dialog).not.toBeVisible();
    const unchangedUnit = await api('GET', `/admin/units/${unit?.id}`);
    expect(unchangedUnit.category).toBe('222');
    await unitActions.getByRole('button', { name: /^编\s*辑$/ }).click();
    await select('单位类别', '矿');
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    await expect(dialog).not.toBeVisible();
    await expect(unitRow).toContainText('矿');
    const changedUnit = await api('GET', `/admin/units/${unit?.id}`);
    expect(changedUnit.category).toBe('mine');
    await select('单位类别', '矿');
    await page.getByRole('button', { name: /^搜\s*索$/ }).click();
    await expect(
      page.locator('.vxe-table--body-wrapper').first(),
    ).not.toContainText('字典接入验收单位');
    await expect(unitRow).toContainText('矿');
    await page.screenshot({
      path: testInfo.outputPath('unit-category.png'),
      fullPage: true,
    });
    await page.goto(menuUrl('/admin/dictionaries'));
    await page.getByRole('button', { name: 'sys_gender', exact: true }).click();
    const refreshed = page.waitForResponse((r) =>
      r.url().includes('/cache/refresh'),
    );
    await page.getByRole('button', { name: '刷新缓存', exact: true }).click();
    const refreshResponse = await refreshed;
    expect(refreshResponse.ok()).toBeTruthy();
  } finally {
    // 恢复测试种子与本人资料，删除自建单位；不操作其他任务数据。
    const currentItems = await api('GET', `${root}/items`);
    const current = currentItems.records.find(
      (row: { id: string }) => row.id === male.id,
    );
    await api(
      current ? 'PUT' : 'POST',
      current ? `${root}/items/${male.id}` : `${root}/items`,
      {
        label: '男',
        value: '1',
        sortOrder: 10,
        ...(current ? { version: current.version } : {}),
      },
    );
    const latest = await api('GET', '/auth/profile');
    await api('PUT', '/auth/profile', {
      name: profile.name,
      gender: profile.gender,
      version: latest.version,
    });
    if (unit) {
      const latestUnit = await api('GET', `/admin/units/${unit.id}`);
      await api(
        'DELETE',
        `/admin/units/${unit.id}?version=${latestUnit.version}`,
      );
    }
    await page.request.post('/api/auth/logout', { headers });
  }
});
