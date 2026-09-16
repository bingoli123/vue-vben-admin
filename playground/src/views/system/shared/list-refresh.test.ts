import type { Component } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h, onMounted, ref } from 'vue';

import { Tree } from '@vben/common-ui';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UnitList from '../dept/list.vue';
import MenuList from '../menu/list.vue';
import RoleList from '../role/list.vue';
import UserList from '../user/list.vue';

const fixture = vi.hoisted(() => ({
  values: {} as Record<string, any>,
  rows: [] as Record<string, any>[],
  getList: vi.fn(),
  getDetail: vi.fn(),
  save: vi.fn(),
  reload: vi.fn(),
}));

// 列表、业务表单、抽屉连接使用真实实现；接口与表格绘制使用确定性替身。
vi.mock(
  '../../../../../packages/@core/ui-kit/popup-ui/src/drawer/drawer.vue',
  () => ({
    default: { name: 'DrawerSurface', render: () => null },
  }),
);
vi.mock('./grants.vue', () => ({ default: { render: () => null } }));
vi.mock('./password.vue', () => ({ default: { render: () => null } }));
vi.mock('../user/modules/detail.vue', () => ({
  default: { render: () => null },
}));
vi.mock('@vben/access', () => ({
  useAccess: () => ({ hasAccessByCodes: () => true }),
}));
vi.mock('@vben/stores', () => ({
  useUserStore: () => ({ userInfo: { userId: 'admin' } }),
}));
vi.mock('antdv-next', () => {
  const Content = (_: unknown, { slots }: any) => h('div', slots.default?.());
  return {
    Alert: Content,
    Card: Content,
    Tag: Content,
    Switch: Content,
    Button: (_: unknown, { slots, attrs }: any) =>
      h('button', attrs, slots.default?.()),
    Modal: { confirm: vi.fn() },
    message: { success: vi.fn() },
  };
});
vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    { render: () => null },
    {
      reset: vi.fn(),
      setState: vi.fn(),
      setValues: vi.fn(),
      getValues: async () => fixture.values,
      validate: async () => ({ valid: true }),
    },
  ],
}));
vi.mock('./schema', () => ({ schemaFor: () => [], searchSchema: () => [] }));
vi.mock('#/api/core/menu', () => ({ menuIcon: (icon: string) => icon }));
vi.mock('#/api/system/admin', () => ({
  getDetail: fixture.getDetail,
  getList: fixture.getList,
  saveRecord: fixture.save,
  unitOptions: async () => [],
  asTree: (items: unknown[]) => items,
  permission: (kind: string, action: string) => `${kind}:${action}`,
  changeStatus: vi.fn(),
  deleteRecord: vi.fn(),
}));
vi.mock('#/adapter/vxe-table', () => ({
  useVbenVxeGrid: (options: any) => {
    const rows = ref<Record<string, any>[]>([]);
    async function query() {
      const result = await options.gridOptions.proxyConfig.ajax.query(
        { page: { currentPage: 1, pageSize: 20 } },
        {},
      );
      rows.value = Array.isArray(result) ? result : result.items;
    }
    return [
      defineComponent({
        setup(_, { slots }) {
          onMounted(query);
          return () =>
            h('section', [
              slots['toolbar-tools']?.(),
              ...rows.value.map((row) =>
                h('div', { class: 'test-row' }, [
                  h('span', row.name),
                  slots.action?.({ row }),
                ]),
              ),
            ]);
        },
      }),
      {
        query,
        reload: async () => {
          fixture.reload();
          await query();
        },
      },
    ];
  },
  VbenTableAction: (props: any) =>
    h(
      'div',
      props.actions?.map((action: any) =>
        h('button', { onClick: action.onClick }, action.text),
      ),
    ),
}));

const wrappers: ReturnType<typeof mount>[] = [];
const pages = [
  ['用户', UserList],
  ['角色', RoleList],
  ['单位', UnitList],
  ['菜单', MenuList],
] as const;
function openPage(component: Component) {
  const wrapper = mount(component);
  wrappers.push(wrapper);
  return wrapper;
}
function drawerApi(wrapper: ReturnType<typeof mount>): any {
  return wrapper.findComponent({ name: 'DrawerSurface' }).vm.$attrs.drawerApi;
}
async function click(wrapper: ReturnType<typeof mount>, text: string) {
  const button = wrapper.findAll('button').find((item) => item.text() === text);
  if (!button) throw new Error(`未找到按钮：${text}`);
  await button.trigger('click');
  await flushPromises();
}

beforeEach(() => {
  vi.clearAllMocks();
  fixture.values = { name: '保存后的名称' };
  fixture.rows = [
    {
      id: '1',
      name: '原名称',
      version: 0,
      menuType: 'C',
      pageType: '普通页面',
    },
  ];
  fixture.getList.mockImplementation(async (kind: string) => {
    const items = fixture.rows.map((row) => ({ ...row }));
    return ['menus', 'units'].includes(kind)
      ? items
      : { items, total: items.length };
  });
  fixture.getDetail.mockImplementation(async () => ({ ...fixture.rows[0] }));
  fixture.save.mockImplementation(async (_kind, values, existing) => {
    const saved = { ...values, id: existing?.id ?? '2', version: 1 };
    fixture.rows = existing ? [saved] : [...fixture.rows, saved];
    return saved;
  });
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe('管理列表保存后的数据刷新', () => {
  it('用户切换单位或全部单位时重置分页，并把所选单位交给后端递归筛选', async () => {
    const wrapper = openPage(UserList);
    await flushPromises();
    wrapper.findComponent(Tree).vm.$emit('select', { value: { id: '10' } });
    await flushPromises();
    expect(fixture.reload).toHaveBeenCalledOnce();
    expect(fixture.getList).toHaveBeenLastCalledWith('users', {
      page: 1,
      size: 20,
      unitId: '10',
    });
    await click(wrapper, '全部单位');
    expect(fixture.reload).toHaveBeenCalledTimes(2);
    expect(fixture.getList).toHaveBeenLastCalledWith('users', {
      page: 1,
      size: 20,
      unitId: '',
    });
  });
  it.each(pages)(
    '%s新增保存关闭后重新查询并显示新记录',
    async (name, component) => {
      const wrapper = openPage(component);
      await flushPromises();
      expect(fixture.getList).toHaveBeenCalledOnce();
      await click(wrapper, `新增${name}`);
      drawerApi(wrapper).onConfirm();
      await flushPromises();
      expect(fixture.getList).toHaveBeenCalledOnce();
      drawerApi(wrapper).onClosed();
      await flushPromises();
      expect(fixture.reload).toHaveBeenCalledOnce();
      expect(fixture.getList).toHaveBeenCalledTimes(2);
      expect(wrapper.findAll('.test-row')).toHaveLength(2);
      expect(wrapper.text()).toContain('保存后的名称');
      expect(fixture.save.mock.calls[0]?.[2]).toBeUndefined();
    },
  );
  it.each(pages)(
    '%s编辑保存关闭后重新查询并显示修改后的内容',
    async (_, component) => {
      const wrapper = openPage(component);
      await flushPromises();
      await click(wrapper, '编辑');
      drawerApi(wrapper).onConfirm();
      await flushPromises();
      drawerApi(wrapper).onClosed();
      await flushPromises();
      expect(fixture.reload).toHaveBeenCalledOnce();
      expect(fixture.getList).toHaveBeenCalledTimes(2);
      expect(wrapper.findAll('.test-row')).toHaveLength(1);
      expect(wrapper.text()).toContain('保存后的名称');
      expect(wrapper.text()).not.toContain('原名称');
      expect(fixture.save.mock.calls[0]?.[2]).toMatchObject({
        id: '1',
        version: 0,
      });
    },
  );
});
