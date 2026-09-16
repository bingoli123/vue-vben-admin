import { describe, expect, it, vi } from 'vitest';

import {
  exportOperationLogs,
  getOperationLogs,
  logQueryParams,
} from './operation-log';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
const { download, error } = vi.hoisted(() => ({
  download: vi.fn(),
  error: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: { get } }));
vi.mock('@vben/utils', () => ({ downloadFileFromBlob: download }));
vi.mock('antdv-next', () => ({ message: { error } }));

describe('操作日志真实请求参数', () => {
  it('导出不携带分页，JSON、空文件及请求失败均不触发下载', async () => {
    const source = new Blob(['xlsx'], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    get.mockResolvedValueOnce(source);
    await exportOperationLogs({ module: '用户', page: 3, size: 1 });
    expect(get).toHaveBeenLastCalledWith('/admin/operation-logs/export', {
      params: { module: '用户' },
      responseType: 'blob',
      responseReturn: 'body',
    });
    expect(download).toHaveBeenCalledWith({
      source,
      fileName: '操作日志.xlsx',
    });
    download.mockClear();
    get.mockResolvedValueOnce(new Blob(['{}'], { type: 'application/json' }));
    await exportOperationLogs({});
    get.mockResolvedValueOnce(new Blob([], { type: source.type }));
    await exportOperationLogs({});
    get.mockRejectedValueOnce(new Error('failure'));
    await expect(exportOperationLogs({})).rejects.toThrow('failure');
    expect(download).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(2);
  });
  it('筛选时间保留偏移、空字段省略，分页记录映射为表格结果', async () => {
    const params = logQueryParams(
      {
        operator: '张三',
        status: 'FAILURE',
        browser: '',
        timeRange: ['2026-09-16T00:00:00+08:00', '2026-09-16T23:59:59+08:00'],
      },
      2,
      20,
    );
    expect(params).toEqual({
      operator: '张三',
      status: 'FAILURE',
      startTime: '2026-09-16T00:00:00+08:00',
      endTime: '2026-09-16T23:59:59+08:00',
      page: 2,
      size: 20,
    });
    get.mockResolvedValue({ records: [{ id: '9007199254740993' }], total: 21 });
    expect(await getOperationLogs(params)).toEqual({
      items: [{ id: '9007199254740993' }],
      total: 21,
    });
    expect(get).toHaveBeenCalledWith('/admin/operation-logs', { params });
  });
});
