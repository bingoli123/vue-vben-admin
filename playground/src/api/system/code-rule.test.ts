import { beforeEach, describe, expect, it, vi } from 'vitest';

import { deleteCodeRule, getCodeRules, saveCodeRule } from './code-rule';
const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: request }));

describe('编码规则接口契约', () => {
  beforeEach(() => vi.clearAllMocks());
  it('维护请求只提交格式字段及读取时的版本，不允许回写累计进度', async () => {
    await saveCodeRule(
      {
        name: '人员',
        code: 'personnel',
        prefix: 'P',
        numericLength: 8,
        currentSequence: '0',
        currentSerial: '00000000',
        version: 999,
      },
      { id: '9007199254740993', version: 3 },
    );
    expect(request.put).toHaveBeenCalledWith(
      '/admin/code-rules/9007199254740993',
      {
        name: '人员',
        code: 'personnel',
        prefix: 'P',
        numericLength: 8,
        version: 3,
      },
    );
  });
  it('分页保持服务端补零字符串，不把长序号转为 JS 数字', async () => {
    request.get.mockResolvedValue({
      records: [
        {
          id: '5',
          currentSequence: '9007199254740993',
          currentSerial: '009007199254740993',
        },
      ],
      total: 1,
    });
    const result = await getCodeRules({
      name: '',
      code: '人员',
      page: 2,
      size: 20,
    });
    expect(request.get).toHaveBeenCalledWith('/admin/code-rules', {
      params: { code: '人员', page: 2, size: 20 },
    });
    expect(result.items[0]?.currentSerial).toBe('009007199254740993');
  });
  it('删除提交当前版本', async () => {
    await deleteCodeRule({ id: '5', version: 7 });
    expect(request.delete).toHaveBeenCalledWith('/admin/code-rules/5', {
      params: { version: 7 },
    });
  });
});
