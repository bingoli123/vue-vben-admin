import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  changeStatus,
  deleteRecord,
  roleOptions,
  saveRecord,
  saveRoleGrants,
} from './admin';
const request = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  request: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: request }));
vi.mock('#/api/core/auth', () => ({
  encryptPasswords: vi.fn(async () => ({
    keyId: 'key',
    encrypted: ['cipher'],
  })),
}));

describe('管理接口契约', () => {
  beforeEach(() => vi.clearAllMocks());
  it('手机号写入新增请求，工号可缺省，密码仍只发送密文', async () => {
    await saveRecord('users', {
      username: 'tester',
      name: '测试',
      phone: '13800000000',
      unitId: '1',
      password: 'Password1!',
    });
    const [, body] = request.post.mock.calls[0] ?? [];
    expect(body).toMatchObject({
      phone: '13800000000',
      keyId: 'key',
      encryptedPassword: 'cipher',
    });
    expect(body.employeeNo).toBeUndefined();
    expect(body).not.toHaveProperty('password');
  });
  it('用户编辑不再提交已删除的全拼和考勤号，包括旧缓存中的值', async () => {
    await saveRecord(
      'users',
      {
        username: 'tester',
        phone: '13900000000',
        employeeNo: '0007',
        fullPinyin: 'ceshi',
        attendanceNo: '0088',
      },
      {
        id: '1',
        name: '测试',
        version: 2,
        fullPinyin: 'ceshi',
        attendanceNo: '0088',
      },
    );
    expect(request.put).toHaveBeenCalledWith(
      '/admin/users/1',
      expect.objectContaining({
        phone: '13900000000',
        employeeNo: '0007',
        version: 2,
      }),
    );
    const [, body] = request.put.mock.calls[0] ?? [];
    expect(body).not.toHaveProperty('fullPinyin');
    expect(body).not.toHaveProperty('attendanceNo');
  });
  it('仅提交后端白名单字段，编辑携带读取版本，不提交只读高级设置', async () => {
    await saveRecord(
      'menus',
      {
        name: '测试',
        menuType: 'F',
        perms: 'test:read',
        code: 'wrong',
        pageType: '报表查看',
        activeIcon: 'lucide:user',
        shortcutIcon: 'lucide:star',
        keepAlive: true,
        administrator: true,
      },
      {
        id: '9007199254740993',
        name: '测试',
        version: 4,
        shortcutIcon: 'lucide:star',
      },
    );
    const [path, body] = request.put.mock.calls[0] ?? [];
    expect(path).toBe('/admin/menus/9007199254740993');
    expect(body).toMatchObject({
      version: 4,
      code: null,
      pageType: '普通页面',
      activeIcon: 'lucide:user',
    });
    expect(body).not.toHaveProperty('keepAlive');
    expect(body).not.toHaveProperty('shortcutIcon');
    expect(body).not.toHaveProperty('administrator');
  });
  it('状态、锁定和删除使用独立操作及版本', async () => {
    const row = {
      id: '5',
      name: '测试',
      version: 7,
      enabled: true,
      locked: false,
    };
    await changeStatus('roles', row);
    await changeStatus('users', row);
    await deleteRecord('roles', row);
    expect(request.request).toHaveBeenCalledWith('/admin/roles/5/status', {
      method: 'PATCH',
      data: { enabled: false, version: 7 },
    });
    expect(request.put).toHaveBeenCalledWith('/admin/users/5/lock', {
      locked: true,
      version: 7,
    });
    expect(request.delete).toHaveBeenCalledWith('/admin/roles/5', {
      params: { version: 7 },
    });
  });
  it('不把未加载的授权组当作空集合覆盖', async () => {
    await saveRoleGrants('5', { version: 2, menuIds: [] });
    expect(request.put).toHaveBeenCalledWith('/admin/roles/5/grants', {
      version: 2,
      menuIds: [],
    });
  });
  it('角色选择器读完所有分页', async () => {
    request.get
      .mockResolvedValueOnce({ records: [{ id: '1' }], total: 2 })
      .mockResolvedValueOnce({ records: [{ id: '2' }], total: 2 });
    expect(await roleOptions()).toEqual([{ id: '1' }, { id: '2' }]);
    expect(request.get).toHaveBeenLastCalledWith('/admin/roles/options', {
      params: { page: 2, size: 200 },
    });
  });
});
