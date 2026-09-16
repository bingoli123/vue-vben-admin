import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { requestClient } from '#/api/request';
import {
  dictionaryLabel,
  optionsWithCurrent,
} from '#/api/system/dictionary-options';

import DictionarySelect from './dictionary-select.vue';

vi.mock('#/api/request', () => ({ requestClient: { get: vi.fn() } }));
const values = [
  { label: '男', value: '1', sortOrder: 10 },
  { label: '女', value: '2', sortOrder: 20 },
];
afterEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
});
describe('字典选项原值兜底', () => {
  it('标签转换保留未知值、前导零和空值语义', () => {
    expect(dictionaryLabel(values, '1')).toBe('男');
    expect(dictionaryLabel(values, '222')).toBe('222');
    expect(dictionaryLabel(values, '01')).toBe('01');
    expect(dictionaryLabel(values, null)).toBe('');
    expect(optionsWithCurrent(values, '222').at(-1)?.value).toBe('222');
    expect(optionsWithCurrent(values, null)).toHaveLength(2);
  });
  it('真实选择控件显示旧 key，加载或失去对应选项都不清空已保存值', async () => {
    vi.mocked(requestClient.get).mockResolvedValue({
      type: 'sys_gender',
      items: values,
    });
    const wrapper = mount(DictionarySelect, {
      attachTo: document.body,
      props: { dictionaryType: 'sys_gender', value: '222' },
    });
    await flushPromises();
    expect(wrapper.text()).toContain('222');
    expect(wrapper.emitted('update:value')).toBeUndefined();
    await wrapper.setProps({ value: '1' });
    expect(wrapper.text()).toContain('男');
    vi.mocked(requestClient.get).mockResolvedValue({
      type: 'renamed',
      items: [],
    });
    await wrapper.setProps({ dictionaryType: 'renamed' });
    await flushPromises();
    expect(wrapper.text()).toContain('1');
    expect(wrapper.emitted('update:value')).toBeUndefined();
    wrapper.unmount();
  });
  it('切换类型丢弃晚到请求，加载失败保留原值', async () => {
    let resolveOld: (result: unknown) => void = () => {};
    vi.mocked(requestClient.get).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    const wrapper = mount(DictionarySelect, {
      props: { dictionaryType: 'old', value: '1' },
    });
    vi.mocked(requestClient.get).mockResolvedValueOnce({
      type: 'new',
      items: [{ label: '新选项', value: '1', sortOrder: 0 }],
    });
    await wrapper.setProps({ dictionaryType: 'new' });
    await flushPromises();
    resolveOld({ type: 'old', items: values });
    await flushPromises();
    expect(wrapper.text()).toContain('新选项');
    vi.mocked(requestClient.get).mockRejectedValueOnce(
      new Error('unavailable'),
    );
    await wrapper.setProps({ dictionaryType: 'failed' });
    await flushPromises();
    expect(wrapper.text()).toContain('1');
    expect(wrapper.emitted('update:value')).toBeUndefined();
    wrapper.unmount();
  });
});
