import { flushPromises, shallowMount } from '@vue/test-utils';

import { describe, expect, it, vi } from 'vitest';

import ActionDropdownItem from '../action-dropdown-item.vue';

function mountItem(confirm: () => Promise<unknown>) {
  return shallowMount(ActionDropdownItem, {
    props: {
      action: {
        danger: true,
        popConfirm: { confirm, title: '确认删除？' },
        text: '删除',
      },
    },
    global: { renderStubDefaultSlot: true },
  });
}

describe('表格下拉操作确认', () => {
  it('等待异步操作成功后再关闭下拉菜单', async () => {
    let finish: (() => void) | undefined;
    const confirm = vi.fn(
      () => new Promise<void>((resolve) => (finish = resolve)),
    );
    const wrapper = mountItem(confirm);
    const button = wrapper.findAll('button-stub').at(-1)!;

    await button.trigger('click');
    expect(confirm).toHaveBeenCalledOnce();
    expect(button.attributes('disabled')).toBeDefined();
    expect(wrapper.emitted('confirm')).toBeUndefined();

    finish?.();
    await flushPromises();
    expect(wrapper.emitted('confirm')).toHaveLength(1);
  });

  it('异步操作失败时关闭确认交互且不重复展示错误', async () => {
    const confirm = vi.fn().mockRejectedValue({
      response: { data: { message: '当前单位关联了用户，请先调整用户' } },
    });
    const wrapper = mountItem(confirm);
    const button = wrapper.findAll('button-stub').at(-1)!;

    await button.trigger('click');
    await flushPromises();
    expect(wrapper.emitted('confirm')).toHaveLength(1);
    expect(button.attributes('disabled')).toBe('false');
    expect(wrapper.text()).not.toContain('当前单位关联了用户，请先调整用户');
  });
});
