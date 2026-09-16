import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Form from './modules/form.vue';

const fixture = vi.hoisted(() => ({ save: vi.fn(), detail: vi.fn() }));
vi.mock(
  '../../../../../packages/@core/ui-kit/popup-ui/src/drawer/drawer.vue',
  () => ({ default: { render: () => null } }),
);
vi.mock('#/adapter/form', () => ({
  useVbenForm: () => [
    { render: () => null },
    {
      reset: vi.fn(),
      setState: vi.fn(),
      setValues: vi.fn(),
      getValues: async () => ({ name: '人员' }),
      validate: async () => ({ valid: true }),
    },
  ],
}));
vi.mock('./data', () => ({ formSchema: () => [] }));
vi.mock('#/api/system/code-rule', () => ({
  getCodeRule: fixture.detail,
  saveCodeRule: fixture.save,
}));
vi.mock('antdv-next', () => ({
  Alert: { render: () => null },
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
  fixture.save.mockReset().mockResolvedValue({ id: '5' });
  fixture.detail.mockReset();
});
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));
describe('编码规则表单反馈', () => {
  it('保存成功关闭后刷新一次，重新打开取消不误报成功', async () => {
    const { getApi, success } = setup();
    getApi().setData({}).open();
    await flushPromises();
    await getApi().onConfirm();
    await flushPromises();
    expect(fixture.save).toHaveBeenCalledOnce();
    expect(getApi().store.state.isOpen).toBe(false);
    expect(success).not.toHaveBeenCalled();
    getApi().onClosed();
    await flushPromises();
    expect(success).toHaveBeenCalledOnce();
    getApi().setData({}).open();
    await flushPromises();
    await getApi().close();
    getApi().onClosed();
    expect(success).toHaveBeenCalledOnce();
  });
  it('详情加载失败保持不可提交，不把编辑误保存为新增', async () => {
    fixture.detail.mockRejectedValue(new Error('读取失败'));
    const { getApi, success } = setup();
    getApi().setData({ id: '5' }).open();
    await flushPromises();
    expect(getApi().store.state.loading).toBe(false);
    expect(getApi().store.state.showConfirmButton).toBe(false);
    await getApi().onConfirm();
    expect(fixture.save).not.toHaveBeenCalled();
    expect(success).not.toHaveBeenCalled();
  });
  it('关闭后切换规则时忽略旧详情的迟到响应', async () => {
    let resolveOld!: (value: unknown) => void;
    fixture.detail.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveOld = resolve;
        }),
    );
    fixture.detail.mockResolvedValueOnce({
      id: '6',
      version: 8,
      currentSequence: '124',
      numericLength: 8,
    });
    const { getApi } = setup();
    getApi().setData({ id: '5' }).open();
    await flushPromises();
    await getApi().close();
    await flushPromises();
    getApi().setData({ id: '6' }).open();
    await flushPromises();
    resolveOld({
      id: '5',
      version: 3,
      currentSequence: '123',
      numericLength: 6,
    });
    await flushPromises();
    getApi().onConfirm();
    await flushPromises();
    expect(fixture.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ id: '6', version: 8 }),
    );
  });
  it('真实 HTTP 409 结构的版本冲突保留表单并停止再次覆盖，重新打开取得最新版本', async () => {
    fixture.detail.mockResolvedValue({
      id: '5',
      version: 3,
      currentSequence: '123',
      numericLength: 6,
    });
    const failure = {
      response: { data: { code: 'VERSION_CONFLICT' }, status: 409 },
    };
    fixture.save.mockRejectedValueOnce(failure);
    const { getApi, success } = setup();
    getApi().setData({ id: '5' }).open();
    await flushPromises();
    getApi().onConfirm();
    await flushPromises();
    expect(getApi().store.state.isOpen).toBe(true);
    expect(getApi().store.state.showConfirmButton).toBe(false);
    expect(success).not.toHaveBeenCalled();
    await getApi().onConfirm();
    expect(fixture.save).toHaveBeenCalledOnce();
    await getApi().close();
    getApi().onClosed();
    fixture.detail.mockResolvedValue({
      id: '5',
      version: 4,
      currentSequence: '124',
      numericLength: 6,
    });
    const reopened = setup();
    reopened.getApi().setData({ id: '5' }).open();
    await flushPromises();
    reopened.getApi().onConfirm();
    await flushPromises();
    expect(fixture.save.mock.calls[1]?.[1]).toMatchObject({
      id: '5',
      version: 4,
    });
  });
});
