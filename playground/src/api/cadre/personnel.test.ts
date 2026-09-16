import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  changePersonnelStatus,
  getPersonnelList,
  savePersonnel,
} from './personnel';
const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
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
      undergroundCount: 0,
      penaltyAmount: '0.00',
      salaryCoefficient: '0.1250',
    });
    expect(request.post).toHaveBeenCalledWith('/cadre/personnel', {
      unitId: '9007199254740993',
      name: '张三',
      initials: null,
      employeeNo: null,
      phone: null,
      position: null,
      sortOrder: 0,
      undergroundCount: 0,
      onsiteCount: null,
      watchDutyCount: null,
      stopWorkCount: null,
      dCardCount: null,
      penaltyAmount: '0.00',
      safetySalary: null,
      salaryCoefficient: '0.1250',
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
      undergroundCount: null,
      onsiteCount: null,
      watchDutyCount: null,
      stopWorkCount: null,
      dCardCount: null,
      penaltyAmount: null,
      safetySalary: null,
      salaryCoefficient: null,
      version: 4,
    });
  });
  it('有效状态使用独立PATCH接口和已读版本，不混入资料保存', async () => {
    await changePersonnelStatus({
      id: '9007199254740993',
      enabled: true,
      version: 7,
    });
    expect(request.request).toHaveBeenCalledWith(
      '/cadre/personnel/9007199254740993/status',
      { method: 'PATCH', data: { enabled: false, version: 7 } },
    );
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
