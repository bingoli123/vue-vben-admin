import { describe, expect, it, vi } from 'vitest';

import { getOperationLogs, logQueryParams } from './operation-log';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: { get } }));

describe('操作日志真实请求参数', () => {
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
