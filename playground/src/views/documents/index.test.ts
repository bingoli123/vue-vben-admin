import type { Folder } from '#/api/documents/folders';

import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getFolder, getFolders } from '#/api/documents/folders';

import Documents from './index.vue';

const permissions = vi.hoisted(
  () => new Set(['add', 'delete', 'edit', 'query']),
);
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.some((code) => permissions.has(code.split(':').at(-1) ?? '')),
  }),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/api/documents/folders', () => ({
  getFolders: vi.fn(),
  getFolder: vi.fn(),
  getFolderUnits: vi.fn(async () => []),
  saveFolder: vi.fn(),
  deleteFolder: vi.fn(),
  folderPermission: (action: string) => `platform:document-folder:${action}`,
}));

const folder = (
  id: string,
  name: string,
  parentId: null | string = null,
): Folder => ({
  id,
  name,
  parentId,
  unitId: '10',
  unitName: '授权单位',
  sortOrder: 0,
  description: null,
  version: 0,
  createdBy: '1',
  updatedBy: '1',
  createdAt: '2026-09-16T10:00:00Z',
  updatedAt: '2026-09-16T10:00:00Z',
});
const data = [
  folder('1', '根目录'),
  folder('2', '直属目录', '1'),
  folder('3', '孙目录', '2'),
  folder('4', '其他根'),
];
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('缺少预期测试数据或页面元素');
  return value;
}
let wrapper: ReturnType<typeof mount>;
beforeEach(() => {
  permissions.clear();
  ['query', 'add', 'edit', 'delete'].forEach((action) =>
    permissions.add(action),
  );
  vi.mocked(getFolders).mockResolvedValue(data);
  vi.mocked(getFolder).mockImplementation(async (id) =>
    required(data.find((row) => row.id === id)),
  );
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('文档文件夹页面', () => {
  it('选中当前目录只显示直接内容，刷新后保留选择', async () => {
    wrapper = mount(Documents, { attachTo: document.body });
    await flushPromises();
    expect(wrapper.find('.ant-table').text()).toContain('直属目录');
    expect(wrapper.find('.ant-table').text()).not.toContain('孙目录');
    const child = wrapper
      .findAll('.ant-tree-title')
      .find((node) => node.text() === '直属目录');
    // 根默认折叠，通过当前目录的链接进入子目录。
    await (child ?? wrapper.find('.ant-table button')).trigger('click');
    await flushPromises();
    expect(wrapper.find('.ant-table').text()).toContain('孙目录');
    await required(
      wrapper
        .findAll('button')
        .find((button) => button.text().replaceAll(/\s/g, '') === '刷新'),
    ).trigger('click');
    await flushPromises();
    expect(getFolder).toHaveBeenLastCalledWith('2');
    expect(wrapper.find('.ant-tree-node-selected').text()).toContain(
      '直属目录',
    );
  });
  it('只读权限隐藏维护操作且不请求单位维护候选', async () => {
    permissions.clear();
    permissions.add('query');
    wrapper = mount(Documents);
    await flushPromises();
    for (const label of ['新增根文件夹', '新增子文件夹', '编辑', '删除'])
      expect(wrapper.text()).not.toContain(label);
    expect(wrapper.text()).toContain('根目录');
  });
  it('快速切换目录时较旧的详情响应不能覆盖当前选择', async () => {
    let finishFirst: ((folder: Folder) => void) | undefined;
    vi.mocked(getFolder).mockImplementation((id) =>
      id === '1'
        ? new Promise((resolve) => {
            finishFirst = resolve;
          })
        : Promise.resolve(required(data[3])),
    );
    wrapper = mount(Documents);
    await flushPromises();
    await required(
      wrapper
        .findAll('.ant-tree-title')
        .find((node) => node.text() === '其他根'),
    ).trigger('click');
    await flushPromises();
    required(finishFirst)(required(data[0]));
    await flushPromises();
    expect(wrapper.find('.ant-descriptions').text()).toContain('其他根');
  });
});
