import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';

import SliderCaptcha from './index.vue';

vi.mock('@vben/locales', () => ({ $t: (key: string) => key }));

afterEach(() => vi.restoreAllMocks());

async function drag(wrapper: ReturnType<typeof mount>) {
  const action = wrapper.find('[name="captcha-action"]');
  Object.defineProperty(wrapper.element, 'offsetWidth', { value: 400 });
  Object.defineProperty(action.element, 'offsetWidth', { value: 40 });
  await action.trigger('mousedown', { pageX: 20 });
  await wrapper.trigger('mousemove', { pageX: 390 });
  await flushPromises();
}

describe('slider server verification', () => {
  it('does not pass until the asynchronous verifier succeeds', async () => {
    let accept!: (passed: boolean) => void;
    const verify = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          accept = resolve;
        }),
    );
    const wrapper = mount(SliderCaptcha, { props: { verify } });
    await drag(wrapper);
    expect(verify).toHaveBeenCalledOnce();
    expect(wrapper.emitted('success')).toBeUndefined();
    accept(true);
    await flushPromises();
    expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
    wrapper.unmount();
  });

  it('keeps the slider unverified when the server rejects', async () => {
    const wrapper = mount(SliderCaptcha, {
      props: { verify: async () => false },
    });
    await drag(wrapper);
    expect(wrapper.emitted('success')).toBeUndefined();
    expect(wrapper.emitted('update:modelValue') ?? []).not.toContainEqual([
      true,
    ]);
    wrapper.unmount();
  });

  it('ignores a successful response from an attempt that was reset', async () => {
    let accept!: (passed: boolean) => void;
    const wrapper = mount(SliderCaptcha, {
      props: {
        verify: () =>
          new Promise<boolean>((resolve) => {
            accept = resolve;
          }),
      },
    });
    await drag(wrapper);
    (wrapper.vm as unknown as { resume: () => void }).resume();
    accept(true);
    await flushPromises();
    expect(wrapper.emitted('success')).toBeUndefined();
    wrapper.unmount();
  });

  it('does not start verification while disabled', async () => {
    const verify = vi.fn(async () => true);
    const wrapper = mount(SliderCaptcha, { props: { verify, disabled: true } });
    await drag(wrapper);
    expect(verify).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
