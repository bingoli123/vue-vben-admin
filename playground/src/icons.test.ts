import { DOMWrapper, mount } from '@vue/test-utils';

import { IconPicker } from '@vben/common-ui';

import { afterEach, expect, it, vi } from 'vitest';

import { registerAppIcons } from './icons';

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

it('断网时原生图标选择器仍展示 SVG、搜索并回填图标名称', async () => {
  const fetch = vi.fn(() => Promise.reject(new Error('offline')));
  vi.stubGlobal('fetch', fetch);
  registerAppIcons();
  const wrapper = mount(IconPicker, {
    attachTo: document.body,
    props: { prefix: 'lucide', autoFetchApi: false },
  });
  try {
    await wrapper.find('input').trigger('click');
    await vi.waitFor(() => {
      expect(
        document.querySelectorAll('.grid-cols-6 > button svg').length,
      ).toBe(36);
    });
    const search = [...document.querySelectorAll('input')].at(-1);
    expect(search).toBeTruthy();
    await new DOMWrapper(search as HTMLInputElement).setValue('lucide:users');
    await vi.waitFor(() => {
      const count = document.querySelectorAll(
        '.grid-cols-6 > button svg',
      ).length;
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(36);
    });
    await new DOMWrapper(
      document.querySelector('.grid-cols-6 > button') as Element,
    ).trigger('click');
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatch(
      /^lucide:users/,
    );
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    wrapper.unmount();
  }
});
