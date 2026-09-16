import { beforeEach, describe, expect, it, vi } from 'vitest';

import { exportDictionaries, exportDictionaryItems } from './dictionary';

const { get, download, error } = vi.hoisted(() => ({
  get: vi.fn(),
  download: vi.fn(),
  error: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: { get } }));
vi.mock('@vben/utils', () => ({ downloadFileFromBlob: download }));
vi.mock('antdv-next', () => ({ message: { error } }));
const mime =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

describe('字典导出下载边界', () => {
  beforeEach(() => vi.resetAllMocks());
  it('只发送名称和类型，导出不带分页且复用鉴权请求层', async () => {
    const source = new Blob(['xlsx'], { type: mime });
    get.mockResolvedValue(source);
    await exportDictionaries({
      name: '中文_%',
      type: '字典',
      page: 2,
      size: 1,
    });
    expect(get).toHaveBeenCalledWith('/admin/dictionaries/export', {
      params: { name: '中文_%', type: '字典' },
      responseType: 'blob',
      responseReturn: 'body',
    });
    expect(download).toHaveBeenCalledWith({
      source,
      fileName: '数据字典.xlsx',
    });
  });
  it('字典项携带选中字典及独立筛选，原始键值不改写', async () => {
    get.mockResolvedValue(new Blob(['xlsx'], { type: mime }));
    await exportDictionaryItems('123', {
      label: '标签',
      value: '001',
      page: 3,
    });
    expect(get).toHaveBeenCalledWith('/admin/dictionaries/123/items/export', {
      params: { label: '标签', value: '001' },
      responseType: 'blob',
      responseReturn: 'body',
    });
  });
  it('hTTP 权限失败不下载', async () => {
    get.mockRejectedValue(new Error('没有权限'));
    await expect(exportDictionaries({})).rejects.toThrow('没有权限');
    expect(download).not.toHaveBeenCalled();
  });
  it.each(['application/json', 'text/html', mime])(
    '错误类型或空文件不伪装成成功下载：%s',
    async (type) => {
      get.mockResolvedValue(
        new Blob(type === mime ? [] : ['错误内容'], { type }),
      );
      await exportDictionaries({});
      expect(download).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        '导出失败，未收到有效的 Excel 文件，请重试',
      );
    },
  );
});
