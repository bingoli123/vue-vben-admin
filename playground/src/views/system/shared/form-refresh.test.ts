import type { Component } from 'vue';

import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import UnitForm from '../dept/modules/form.vue';
import MenuForm from '../menu/modules/form.vue';
import RoleForm from '../role/modules/form.vue';
import UserForm from '../user/modules/form.vue';

const fixture = vi.hoisted(() => ({
  values: { name: '新增记录' },
  save: vi.fn(),
}));

// 保留真实的父子抽屉连接及生命周期，只替换动画外壳与与本次无关的字段控件。
vi.mock(
  '../../../../../packages/@core/ui-kit/popup-ui/src/drawer/drawer.vue',
  () => ({
    default: { name: 'DrawerSurface', render: () => null },
  }),
);
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
vi.mock('./schema', () => ({ schemaFor: () => [] }));
vi.mock('#/api/core/menu', () => ({ menuIcon: (icon: string) => icon }));
vi.mock('#/api/system/admin', () => ({
  getDetail: vi.fn(),
  saveRecord: fixture.save,
}));

const wrappers: ReturnType<typeof mount>[] = [];
function mountConnectedForm(component: Component, onSuccess: () => void) {
  let api: ReturnType<typeof useVbenDrawer>[1];
  const Host = defineComponent({
    setup() {
      const [Drawer, drawerApi] = useVbenDrawer({
        connectedComponent: component,
        destroyOnClose: true,
      });
      api = drawerApi;
      return () => h(Drawer, { onSuccess });
    },
  });
  const wrapper = mount(Host);
  wrappers.push(wrapper);
  return { wrapper, getApi: () => api };
}

beforeEach(() => fixture.save.mockReset().mockResolvedValue({ id: 'new' }));
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe('管理表单关闭后通知列表刷新', () => {
  it.each([
    ['用户', UserForm],
    ['角色', RoleForm],
    ['单位', UnitForm],
    ['菜单', MenuForm],
  ] as const)(
    '%s新增成功后等待关闭完成，仅通知列表一次；再次取消不刷新',
    async (_, component) => {
      const refreshed = vi.fn();
      const { getApi } = mountConnectedForm(component, refreshed);
      getApi().setData({}).open();
      await flushPromises();
      getApi().onConfirm();
      await flushPromises();
      expect(fixture.save).toHaveBeenCalledOnce();
      expect(getApi().store.state.isOpen).toBe(false);
      // 关闭动画尚未完成，不能提前通知父页面；完成后才重新加载列表。
      expect(refreshed).not.toHaveBeenCalled();
      getApi().onClosed();
      await flushPromises();
      expect(refreshed).toHaveBeenCalledOnce();
      getApi().setData({}).open();
      await flushPromises();
      await getApi().close();
      getApi().onClosed();
      await flushPromises();
      expect(refreshed).toHaveBeenCalledOnce();
    },
  );
});
