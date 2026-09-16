import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPersonnelList, savePersonnel } from './personnel';
const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: request }));
beforeEach(() => vi.clearAllMocks());
describe('人员API契约', () => {
  it('新增不提交编号/账号/规则/状态，仅单位姓名必填；空字段用null，0不丢失', async () => {
    await savePersonnel({
      unitId: '9007199254740993',
      name: '张三',
      number: 'FORGED',
      ruleId: '9',
      enabled: false,
      userId: '1',
      phone: '',
      sortOrder: 0,
    });
    expect(request.post).toHaveBeenCalledWith('/cadre/personnel', {
      unitId: '9007199254740993',
      name: '张三',
      initials: null,
      employeeNo: null,
      phone: null,
      position: null,
      sortOrder: 0,
    });
  });
  it('编辑取已读版本，可清空可选字段而不回写编号', async () => {
    await savePersonnel(
      { unitId: '2', name: '李四', phone: '', version: 999, number: 'FORGED' },
      { id: '3', version: 4 },
    );
    expect(request.put).toHaveBeenCalledWith('/cadre/personnel/3', {
      unitId: '2',
      name: '李四',
      initials: null,
      employeeNo: null,
      phone: null,
      position: null,
      sortOrder: null,
      version: 4,
    });
  });
  it('分页和单位筛选传给服务端，ID和编号保持字符串', async () => {
    request.get.mockResolvedValue({
      records: [{ id: '9007199254740993', number: 'RY000001' }],
      total: 1,
    });
    const result = await getPersonnelList({
      unitId: '2',
      name: '',
      initials: 'zs',
      page: 2,
      size: 20,
    });
    expect(request.get).toHaveBeenCalledWith('/cadre/personnel', {
      params: { unitId: '2', initials: 'zs', page: 2, size: 20 },
    });
    expect(result.items[0]?.id).toBe('9007199254740993');
  });
});
