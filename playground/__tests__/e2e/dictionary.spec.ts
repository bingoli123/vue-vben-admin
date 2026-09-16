import process from 'node:process';

import { expect, test } from '@playwright/test';

/** 从登录、真实接口到可见表单验收，不 mock 页面组件或业务服务。仅删除本测试创建的字典。 */
test('管理员维护字典与字典项，删除所选字典清空右侧', async ({
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
  const menu = flatten(navigation.data).find(
    (n) => n.url === '/admin/dictionaries',
  );
  if (!menu) throw new Error('迁移应提供数据字典菜单');
  await page.goto(`/menus/${menu.id}`);

  const type = `e2e-${Date.now()}`;
  const name = `验收字典${Date.now()}`;
  const left = page.getByTestId('dictionary-list');
  const right = page.getByTestId('dictionary-items');
  const dialog = page.getByRole('dialog');
  const pagingRows: { id: string; version: number }[] = [];
  try {
    await left.getByRole('button', { name: '新增字典', exact: true }).click();
    await dialog.getByPlaceholder('请输入字典名称').fill(name);
    await dialog.getByPlaceholder('请输入字典类型').fill(type);
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    await expect(dialog).not.toBeVisible();
    await left.getByRole('button', { name: type, exact: true }).click();
    await right
      .getByRole('button', { name: '新增字典项', exact: true })
      .click();
    await dialog.getByPlaceholder('请输入字典标签').fill('首个标签');
    await dialog.getByPlaceholder('请输入字典键值').fill('01');
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    await expect(right).toContainText('首个标签');
    await right.getByPlaceholder('搜索字典标签').fill('不存在的标签');
    await right.getByRole('button', { name: /^搜\s*索$/ }).click();
    await expect(right).not.toContainText('首个标签');
    await right.getByRole('button', { name: /^重\s*置$/ }).click();
    await expect(right).toContainText('首个标签');
    await right
      .getByRole('button', { name: /^编\s*辑$/ })
      .first()
      .click();
    await dialog.getByPlaceholder('请输入字典标签').fill('修改后的标签');
    await dialog.getByPlaceholder('请输入字典键值').fill('02');
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    await expect(right).toContainText('修改后的标签');
    await expect(right).not.toContainText('首个标签');
    await right
      .getByRole('button', { name: /^编\s*辑$/ })
      .first()
      .click();
    await dialog.getByPlaceholder('请输入字典标签').fill('取消的内容');
    await dialog.getByRole('button', { name: /^取\s*消$/ }).click();
    await expect(dialog).not.toBeVisible();
    await expect(right).not.toContainText('取消的内容');
    await left.getByPlaceholder('搜索字典类型').fill('不存在的字典');
    await left.getByRole('button', { name: /^搜\s*索$/ }).click();
    await expect(right).toContainText('请选择左侧字典');
    await left.getByRole('button', { name: /^重\s*置$/ }).click();
    await left.getByRole('button', { name: type, exact: true }).click();
    await expect(right).toContainText('修改后的标签');
    await page.screenshot({
      path: testInfo.outputPath('dictionary-maintenance.png'),
      fullPage: true,
    });
    await right
      .getByRole('button', { name: /^删\s*除$/ })
      .first()
      .click();
    await page.getByRole('button', { name: /^确\s*定$/ }).click();
    await expect(right).not.toContainText('修改后的标签');
    // 左表可能已有其他资料，先限定本次唯一类型；多匹配时失败，不操作不属于本用例的行。
    await left.getByPlaceholder('搜索字典类型').fill(type);
    await left.getByRole('button', { name: /^搜\s*索$/ }).click();
    await expect(
      left.getByRole('button', { name: type, exact: true }),
    ).toBeVisible();
    await expect(left.getByRole('button', { name: /^编\s*辑$/ })).toHaveCount(
      1,
    );
    await left.getByRole('button', { name: /^编\s*辑$/ }).click();
    await dialog.getByPlaceholder('请输入字典名称').fill(`${name}已修改`);
    await dialog.getByRole('button', { name: /^确\s*认$/ }).click();
    await expect(left).toContainText(`${name}已修改`);
    await left.getByRole('button', { name: /^删\s*除$/ }).click();
    await page.getByRole('button', { name: /^确\s*定$/ }).click();
    await expect(left).not.toContainText(`${name}已修改`);
    await expect(right).toContainText('请选择左侧字典');

    // 独立样本覆盖两侧分页：翻走所选字典清空右侧，切换字典重置项筛选和页码。
    const pagingType = `page-${type}`;
    for (let index = 0; index < 21; index++) {
      const result = await page.request.post('/api/admin/dictionaries', {
        headers,
        data: { name: `分页字典${index}`, type: `${pagingType}-${index}` },
      });
      expect(result.ok()).toBeTruthy();
      const created = await result.json();
      pagingRows.push(created.data);
    }
    const firstDictionary = pagingRows[0];
    if (!firstDictionary) throw new Error('未创建分页样本');
    for (let index = 0; index < 21; index++) {
      const result = await page.request.post(
        `/api/admin/dictionaries/${firstDictionary.id}/items`,
        {
          headers,
          data: {
            label: `分页标签${index}`,
            value: `${index}`,
            sortOrder: index,
          },
        },
      );
      expect(result.ok()).toBeTruthy();
    }
    await left.getByPlaceholder('搜索字典类型').fill(pagingType);
    await left.getByRole('button', { name: /^搜\s*索$/ }).click();
    await left
      .getByRole('button', { name: `${pagingType}-0`, exact: true })
      .click();
    await expect(right).toContainText('分页标签0');
    await expect(right).not.toContainText('分页标签20');
    await right.getByTitle('下一页', { exact: true }).click();
    await expect(right).toContainText('分页标签20');
    await expect(right).not.toContainText('分页标签0');
    await left.getByTitle('下一页', { exact: true }).click();
    await expect(right).toContainText('请选择左侧字典');
    await left
      .getByRole('button', { name: `${pagingType}-20`, exact: true })
      .click();
    await expect(right).not.toContainText('分页标签20');
    await left.getByTitle('上一页', { exact: true }).click();
    await expect(right).toContainText('请选择左侧字典');
    await left
      .getByRole('button', { name: `${pagingType}-0`, exact: true })
      .click();
    await expect(right).toContainText('分页标签0');
    await right.getByPlaceholder('搜索字典标签').fill('不存在的标签');
    await right.getByRole('button', { name: /^搜\s*索$/ }).click();
    await expect(right).not.toContainText('分页标签0');
    await left
      .getByRole('button', { name: `${pagingType}-1`, exact: true })
      .click();
    await expect(right.getByPlaceholder('搜索字典标签')).toHaveValue('');
    await left
      .getByRole('button', { name: `${pagingType}-0`, exact: true })
      .click();
    await expect(right).toContainText('分页标签0');
  } finally {
    // 失败时按唯一类型查找并回收本用例的资料，不清空共享数据库。
    const result = await page.request.get('/api/admin/dictionaries', {
      headers,
      params: { type },
    });
    if (result.ok()) {
      const remaining = await result.json();
      for (const row of remaining.data.records) {
        if (row.type === type)
          await page.request.delete(`/api/admin/dictionaries/${row.id}`, {
            headers,
            params: { version: row.version },
          });
      }
    }
    for (const row of pagingRows) {
      const result = await page.request.delete(
        `/api/admin/dictionaries/${row.id}`,
        {
          headers,
          params: { version: row.version },
        },
      );
      expect(result.ok()).toBeTruthy();
    }
    await page.request.post('/api/auth/logout', { headers });
  }
});
