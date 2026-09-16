import process from 'node:process';

import { expect, test } from '@playwright/test';

/** 从登录、真实接口到可见表单验收，不 mock 页面组件或业务服务。仅删除本测试创建的字典。 */
test('按筛选导出全量字典与字典项，失败不下载', async ({ page }, testInfo) => {
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
  const loginResponse = page
    .waitForResponse((r) => r.url().endsWith('/auth/login'))
    .then((response) => response.json());
  await page.getByRole('button', { name: 'login', exact: true }).click();
  const login = await loginResponse;
  const headers = { Authorization: `Bearer ${login.data.token}` };
  await expect(page).not.toHaveURL(/\/auth\/login/);
  const menus = await page.request.get('/api/auth/menus', { headers });
  type Menu = { children?: Menu[]; id: string; url?: string };
  const flatten = (nodes: Menu[]): Menu[] =>
    nodes.flatMap((n) => [n, ...flatten(n.children ?? [])]);
  const navigation = await menus.json();
  const menu = flatten(navigation.data).find(
    (n) => n.url === '/admin/dictionaries',
  );
  if (!menu) throw new Error('迁移应提供数据字典菜单');
  await page.goto(`/menus/${menu.id}`);

  const prefix = `export-${Date.now()}`;
  const left = page.getByTestId('dictionary-list');
  const right = page.getByTestId('dictionary-items');
  const rows: { id: string; version: number }[] = [];
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    for (let index = 0; index < 21; index++) {
      const result = await page.request.post('/api/admin/dictionaries', {
        headers,
        data: {
          name: `导出字典_${index}`,
          type: `${prefix}-${index}`,
          remark: '中文,引号"与换行\n<&>',
        },
      });
      expect(result.ok()).toBeTruthy();
      const created = await result.json();
      rows.push(created.data);
    }
    const first = rows[0];
    if (!first) throw new Error('缺少样本');
    for (let index = 0; index < 21; index++) {
      const result = await page.request.post(
        `/api/admin/dictionaries/${first.id}/items`,
        {
          headers,
          data: {
            label: `导出标签_${index}`,
            value: index === 1 ? '=1+1' : String(index).padStart(3, '0'),
            sortOrder: index,
            remark: '中文,引号"与换行\n<&>',
          },
        },
      );
      expect(result.ok()).toBeTruthy();
    }
    await left.getByPlaceholder('搜索字典类型').fill(prefix);
    await left.getByRole('button', { name: /^搜\s*索$/ }).click();
    await left
      .getByRole('button', { name: `${prefix}-0`, exact: true })
      .click();
    await expect(right).toContainText('导出标签_0');
    // 未提交的草稿输入不改变已显示列表对应的导出条件。
    await left.getByPlaceholder('搜索字典类型').fill('未提交的筛选');
    let downloadEvent = page.waitForEvent('download');
    await left.getByRole('button', { name: '导出字典', exact: true }).click();
    let download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('数据字典.xlsx');
    await download.saveAs(testInfo.outputPath('dictionaries.xlsx'));
    await right.getByTitle('下一页', { exact: true }).click();
    await expect(right).toContainText('导出标签_20');
    downloadEvent = page.waitForEvent('download');
    await right
      .getByRole('button', { name: '导出字典项', exact: true })
      .click();
    download = await downloadEvent;
    expect(download.suggestedFilename()).toBe('字典项.xlsx');
    await download.saveAs(testInfo.outputPath('items.xlsx'));
    await right.getByPlaceholder('搜索字典键值').fill('001');
    await right.getByRole('button', { name: /^搜\s*索$/ }).click();
    downloadEvent = page.waitForEvent('download');
    await right
      .getByRole('button', { name: '导出字典项', exact: true })
      .click();
    download = await downloadEvent;
    await download.saveAs(testInfo.outputPath('empty.xlsx'));
    await right.getByPlaceholder('搜索字典键值').fill('002');
    await right.getByRole('button', { name: /^搜\s*索$/ }).click();
    await expect(right).toContainText('导出标签_2');
    downloadEvent = page.waitForEvent('download');
    await right
      .getByRole('button', { name: '导出字典项', exact: true })
      .click();
    download = await downloadEvent;
    await download.saveAs(testInfo.outputPath('filtered.xlsx'));
    await page.screenshot({
      path: testInfo.outputPath('dictionary-export.png'),
      fullPage: true,
    });
    // 选中后记录被其他操作者删除：后端返回 JSON 404，页面显示提示而非下载损坏文件。
    const removed = await page.request.delete(
      `/api/admin/dictionaries/${first.id}`,
      { headers, params: { version: first.version } },
    );
    expect(removed.ok()).toBeTruthy();
    rows.shift();
    const downloads: string[] = [];
    page.on('download', (file) => downloads.push(file.suggestedFilename()));
    const failedResponse = page.waitForResponse((r) =>
      r.url().includes('/items/export'),
    );
    await right
      .getByRole('button', { name: '导出字典项', exact: true })
      .click();
    const failed = await failedResponse;
    expect(failed.status()).toBe(404);
    const failure = await failed.json();
    await expect(
      page.getByText(failure.message, { exact: true }),
    ).toBeVisible();
    expect(downloads).toEqual([]);
    expect(pageErrors).toEqual([]);
  } finally {
    for (const row of rows) {
      const result = await page.request.delete(
        `/api/admin/dictionaries/${row.id}`,
        { headers, params: { version: row.version } },
      );
      expect(result.ok()).toBeTruthy();
    }
    await page.request.post('/api/auth/logout', { headers });
  }
});
