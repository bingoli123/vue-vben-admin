import type { DocumentFile } from '#/api/documents/files';
import type { Folder } from '#/api/documents/folders';

import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  downloadFile,
  getFile,
  getFiles,
  uploadFile,
} from '#/api/documents/files';

import Files from './files.vue';

// 测试仅加载实际用到的组件，避免日期选择器的 Node ESM 扩展名兼容问题。
vi.mock('antdv-next', async () => {
  const AlertModule = await import('antdv-next/dist/alert/index');
  const ButtonModule = await import('antdv-next/dist/button/index');
  const CardModule = await import('antdv-next/dist/card/index');
  const DescriptionsModule = await import('antdv-next/dist/descriptions/index');
  const EmptyModule = await import('antdv-next/dist/empty/index');
  const FormModule = await import('antdv-next/dist/form/index');
  const InputModule = await import('antdv-next/dist/input/index');
  const InputNumberModule = await import('antdv-next/dist/input-number/index');
  const messageModule = await import('antdv-next/dist/message/index');
  const ModalModule = await import('antdv-next/dist/modal/index');
  const SpaceModule = await import('antdv-next/dist/space/index');
  const SpinModule = await import('antdv-next/dist/spin/index');
  const TableModule = await import('antdv-next/dist/table/index');
  const TreeModule = await import('antdv-next/dist/tree/index');
  const TreeSelectModule = await import('antdv-next/dist/tree-select/index');
  return {
    Alert: AlertModule.default,
    Button: ButtonModule.default,
    Card: CardModule.default,
    Descriptions: DescriptionsModule.default,
    Empty: EmptyModule.default,
    Form: FormModule.default,
    Input: InputModule.default,
    InputNumber: InputNumberModule.default,
    message: messageModule.default,
    Modal: ModalModule.default,
    Space: SpaceModule.default,
    Spin: SpinModule.default,
    Table: TableModule.default,
    Tree: TreeModule.default,
    TreeSelect: TreeSelectModule.default,
    DescriptionsItem: DescriptionsModule.DescriptionsItem,
    FormItem: FormModule.FormItem,
  };
});

const permissions = vi.hoisted(() => new Set(['download', 'query', 'upload']));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.some((c) => permissions.has(c.split(':').at(-1) ?? '')),
  }),
}));
vi.mock('#/api/documents/files', () => ({
  getFile: vi.fn(),
  getFiles: vi.fn(),
  uploadFile: vi.fn(),
  downloadFile: vi.fn(),
  filePermission: (action: string) => `platform:document-file:${action}`,
}));
const folder = (id: string): Folder => ({
  id,
  name: `目录${id}`,
  unitId: '10',
  unitName: '归属单位',
  parentId: null,
  sortOrder: 0,
  description: null,
  version: 0,
  createdBy: '1',
  updatedBy: '1',
  createdAt: '',
  updatedAt: '',
});
const file = (id: string): DocumentFile => ({
  id,
  folderId: id,
  unitId: '10',
  name: `原文件${id}.txt`,
  extension: 'txt',
  size: 12,
  contentType: 'text/plain',
  sha256: 'f'.repeat(64),
  category: '制度',
  uploaderId: '2',
  uploaderName: '上传人',
  uploaderUnitId: '20',
  uploaderUnitName: '上传时单位',
  createdAt: '2026-09-16T10:00:00Z',
  updatedAt: '2026-09-16T10:00:00Z',
  updatedBy: '2',
  version: 0,
});
let wrapper: ReturnType<typeof mount>;
function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('缺少测试元素');
  return value;
}
function button(label: string, root = new DOMWrapper(document.body)) {
  return required(
    root
      .findAll('button')
      .find((b) => b.text().replaceAll(/\s/g, '') === label),
  );
}
beforeEach(() => {
  permissions.clear();
  ['query', 'upload', 'download'].forEach((p) => permissions.add(p));
  vi.mocked(getFiles).mockImplementation(async (q) => ({
    records: [file(q.folderId)],
    total: 1,
    page: q.page,
    size: q.size,
  }));
  vi.mocked(getFile).mockImplementation(async (id) => file(id));
  vi.mocked(uploadFile).mockResolvedValue(file('1'));
});
afterEach(() => {
  wrapper?.unmount();
  document.body.innerHTML = '';
  vi.clearAllMocks();
});

describe('文档原文件交互', () => {
  it('切目录清除筛选并丢弃旧列表响应', async () => {
    let finish:
      | ((result: Awaited<ReturnType<typeof getFiles>>) => void)
      | undefined;
    vi.mocked(getFiles).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    wrapper = mount(Files, {
      props: { folder: folder('1') },
      attachTo: document.body,
    });
    await wrapper.setProps({ folder: folder('2') });
    await flushPromises();
    required(finish)({ records: [file('1')], total: 1, page: 1, size: 20 });
    await flushPromises();
    expect(wrapper.find('.ant-table').text()).toContain('原文件2.txt');
    expect(wrapper.find('.ant-table').text()).not.toContain('原文件1.txt');
    await wrapper.find('[aria-label="文件名称筛选"]').setValue('报告');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(getFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ folderId: '2', name: '报告', page: 1 }),
    );
    await wrapper.setProps({ folder: folder('3') });
    await flushPromises();
    expect(getFiles).toHaveBeenLastCalledWith(
      expect.objectContaining({ folderId: '3', name: '', page: 1 }),
    );
  });
  it('上传目标固定且失败保留表单，重试后刷新当前目录', async () => {
    wrapper = mount(Files, {
      props: { folder: folder('1') },
      attachTo: document.body,
    });
    await flushPromises();
    await button('上传文件').trigger('click');
    await flushPromises();
    const input = new DOMWrapper(document.body).find('input[type=file]');
    const raw = new File(['原文'], '测试.txt', { type: 'text/plain' });
    Object.defineProperty(input.element, 'files', {
      value: [raw],
      configurable: true,
    });
    await input.trigger('change');
    await wrapper.setProps({ folder: folder('2') });
    await flushPromises();
    vi.mocked(uploadFile).mockRejectedValueOnce(new Error('受控上传失败'));
    await button('上传').trigger('click');
    await flushPromises();
    expect(uploadFile).toHaveBeenCalledWith('1', raw, '');
    expect(document.body.textContent).toContain('上传原文件');
    expect(document.body.textContent).toContain('目录1');
    await wrapper.setProps({ folder: folder('1') });
    await flushPromises();
    const before = vi.mocked(getFiles).mock.calls.length;
    await button('上传').trigger('click');
    await flushPromises();
    expect(getFiles).toHaveBeenCalledTimes(before + 1);
  });
  it('只读用户有详情但不显示上传下载，详情显示上传时单位', async () => {
    permissions.delete('upload');
    permissions.delete('download');
    wrapper = mount(Files, {
      props: { folder: folder('1') },
      attachTo: document.body,
    });
    await flushPromises();
    expect(wrapper.text()).not.toContain('上传文件');
    expect(wrapper.text()).not.toContain('下载');
    await button('详情').trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('上传时单位');
    expect(document.body.textContent).toContain('归属单位');
  });
  it('下载只传选择的文件，失败后恢复按钮', async () => {
    vi.mocked(downloadFile).mockRejectedValueOnce(new Error('存储不可用'));
    wrapper = mount(Files, {
      props: { folder: folder('1') },
      attachTo: document.body,
    });
    await flushPromises();
    await button('下载').trigger('click');
    await flushPromises();
    expect(downloadFile).toHaveBeenCalledWith(file('1'));
    expect(button('下载').attributes('disabled')).toBeUndefined();
  });
});
