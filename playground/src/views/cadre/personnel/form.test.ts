import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Form from './modules/form.vue';

const fixture = vi.hoisted(() => ({
  save: vi.fn(),
  detail: vi.fn(),
  units: vi.fn(),
  initials: vi.fn(),
}));
vi.mock(
  '../../../../../packages/@core/ui-kit/popup-ui/src/drawer/drawer.vue',
  () => ({ default: { render: () => null } }),
);
vi.mock('#/api/cadre/personnel', () => ({
  getPersonnel: fixture.detail,
  getPersonnelUnits: fixture.units,
  savePersonnel: fixture.save,
  suggestInitials: fixture.initials,
}));
vi.mock('#/api/system/admin', () => ({ asTree: (items: unknown[]) => items }));
vi.mock('antdv-next', () => ({
  Alert: { render: () => null },
  Button: { render: () => null },
  Form: { render: () => null },
  FormItem: { render: () => null },
  Input: { render: () => null },
  InputNumber: { render: () => null },
  TreeSelect: { render: () => null },
  message: { success: vi.fn() },
}));
const wrappers: ReturnType<typeof mount>[] = [];
function setup() {
  let api: ReturnType<typeof useVbenDrawer>[1];
  const success = vi.fn();
  const wrapper = mount(
    defineComponent({
      setup() {
        const [Drawer, drawerApi] = useVbenDrawer({
          connectedComponent: Form,
          destroyOnClose: true,
        });
        api = drawerApi;
        return () => h(Drawer, { onSuccess: success });
      },
    }),
  );
  wrappers.push(wrapper);
  return { getApi: () => api, success };
}
beforeEach(() => {
  fixture.units.mockReset().mockResolvedValue([]);
  fixture.detail.mockReset();
  fixture.save.mockReset();
});
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
describe('人员抽屉加载边界', () => {
  it('详情失败禁止确认，不把编辑变为新增', async () => {
    fixture.detail.mockRejectedValue(new Error('不存在'));
    const { getApi, success } = setup();
    getApi().setData({ id: '3' }).open();
    await flushPromises();
    expect(getApi().store.state.loading).toBe(false);
    expect(getApi().store.state.showConfirmButton).toBe(false);
    getApi().onConfirm();
    await flushPromises();
    expect(fixture.save).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
  it('单位候选未加载成功时不能提交', async () => {
    fixture.units.mockRejectedValue(new Error('无权限'));
    const { getApi } = setup();
    getApi().setData({ unitId: '1' }).open();
    await flushPromises();
    expect(getApi().store.state.showConfirmButton).toBe(false);
    getApi().onConfirm();
    await flushPromises();
    expect(fixture.save).not.toHaveBeenCalled();
  });
});
