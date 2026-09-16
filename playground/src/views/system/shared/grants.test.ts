import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Grants from './grants.vue';

const fixture = vi.hoisted(() => ({
  drawer: {} as Record<string, any>,
  selected: [] as string[],
  save: vi.fn(),
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({
    hasAccessByCodes: (codes: string[]) =>
      codes.includes('platform:role:authorize'),
  }),
}));
vi.mock('@vben/common-ui', async (original) => ({
  ...(await original<object>()),
  useVbenDrawer: (options: Record<string, any>) => {
    fixture.drawer = options;
    return [
      defineComponent({
        setup:
          (_, { slots }) =>
          () =>
            h('div', slots.default?.()),
      }),
      {
        getData: () => ({
          kind: 'roles',
          row: { id: 'role', name: '报表管理员' },
        }),
        setState: vi.fn(),
        lock: vi.fn(),
        unlock: vi.fn(),
        close: vi.fn(),
      },
    ];
  },
}));
vi.mock('antdv-next', () => {
  const Content = defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        h('div', slots.default?.()),
  });
  return {
    Alert: Content,
    Tabs: Content,
    TabPane: Content,
    message: { success: vi.fn(), warning: vi.fn() },
  };
});
vi.mock('#/api/request', () => ({ requestClient: {} }));
vi.mock('#/api/core/auth', () => ({ encryptPasswords: vi.fn() }));
vi.mock('#/api/system/admin', async (original) => ({
  ...(await original<object>()),
  getRoleMenus: async () => ({
    version: 3,
    menuIds: [...fixture.selected],
    menus: [],
  }),
  menuOptions: async () => [
    { id: 'system', name: '系统管理', enabled: true },
    { id: 'users', parentId: 'system', name: '用户管理', enabled: true },
    { id: 'read', parentId: 'users', name: '查询用户', enabled: true },
    { id: 'add', parentId: 'users', name: '新增用户', enabled: true },
    { id: 'report', parentId: 'system', name: '报表查看', enabled: true },
  ],
  saveRoleGrants: fixture.save,
}));

const mounted: ReturnType<typeof mount>[] = [];
async function open() {
  const wrapper = mount(Grants);
  mounted.push(wrapper);
  await fixture.drawer.onOpenChange(true);
  await flushPromises();
  return wrapper;
}
function node(wrapper: ReturnType<typeof mount>, name: string) {
  const result = wrapper
    .findAll('.tree-node')
    .find((item) => item.text() === name);
  if (!result) throw new Error(`未找到树节点：${name}`);
  return result;
}
const checkbox = (wrapper: ReturnType<typeof mount>, name: string) =>
  node(wrapper, name).find('[role="checkbox"]');
const half = (wrapper: ReturnType<typeof mount>, name: string) =>
  checkbox(wrapper, name).find('svg.lucide-minus').exists();
async function click(wrapper: ReturnType<typeof mount>, name: string) {
  await checkbox(wrapper, name).trigger('click');
  await flushPromises();
}
beforeEach(() => {
  fixture.selected = [];
  fixture.save.mockClear();
});
afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount());
});

describe('角色功能权限父子联动', () => {
  it('部分子项选中父项半选，全部子项选中父项全选，取消后回到半选', async () => {
    const wrapper = await open();
    await click(wrapper, '新增用户');
    expect(half(wrapper, '用户管理')).toBe(true);
    expect(half(wrapper, '系统管理')).toBe(true);
    await click(wrapper, '查询用户');
    expect(half(wrapper, '用户管理')).toBe(false);
    expect(checkbox(wrapper, '用户管理').attributes('data-state')).toBe(
      'checked',
    );
    expect(half(wrapper, '系统管理')).toBe(true);
    await click(wrapper, '查询用户');
    expect(half(wrapper, '用户管理')).toBe(true);
  });

  it('保存携带必要上级菜单，重新打开保持半选且点击半选父项选中全部子项', async () => {
    const wrapper = await open();
    await click(wrapper, '新增用户');
    await fixture.drawer.onConfirm();
    expect(fixture.save).toHaveBeenCalledWith('role', {
      version: 3,
      menuIds: expect.arrayContaining(['add', 'users', 'system']),
    });
    fixture.selected = fixture.save.mock.calls[0]?.[1].menuIds ?? [];
    expect(fixture.selected).not.toContain('read');
    expect(fixture.selected).not.toContain('report');
    const reopened = await open();
    expect(half(reopened, '用户管理')).toBe(true);
    await click(reopened, '用户管理');
    expect(checkbox(reopened, '查询用户').attributes('data-state')).toBe(
      'checked',
    );
    expect(checkbox(reopened, '新增用户').attributes('data-state')).toBe(
      'checked',
    );
    await click(reopened, '用户管理');
    expect(checkbox(reopened, '查询用户').attributes('data-state')).toBe(
      'unchecked',
    );
    expect(checkbox(reopened, '新增用户').attributes('data-state')).toBe(
      'unchecked',
    );
    await fixture.drawer.onConfirm();
    expect(fixture.save).toHaveBeenLastCalledWith('role', {
      version: 3,
      menuIds: [],
    });
  });

  it('点击父项全选下级，取消一个子项恢复半选；全部取消不残留上级授权', async () => {
    const wrapper = await open();
    await click(wrapper, '系统管理');
    for (const name of [
      '系统管理',
      '用户管理',
      '查询用户',
      '新增用户',
      '报表查看',
    ]) {
      expect(checkbox(wrapper, name).attributes('data-state')).toBe('checked');
      expect(half(wrapper, name)).toBe(false);
    }
    await click(wrapper, '新增用户');
    expect(half(wrapper, '用户管理')).toBe(true);
    expect(half(wrapper, '系统管理')).toBe(true);
    await click(wrapper, '查询用户');
    expect(checkbox(wrapper, '用户管理').attributes('data-state')).toBe(
      'unchecked',
    );
    await click(wrapper, '报表查看');
    await fixture.drawer.onConfirm();
    expect(fixture.save).toHaveBeenLastCalledWith('role', {
      version: 3,
      menuIds: [],
    });
  });
});
