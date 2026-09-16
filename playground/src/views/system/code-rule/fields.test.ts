import { flushPromises, mount } from '@vue/test-utils';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { initSetupVbenForm, useVbenForm } from '#/adapter/form';

import { formSchema } from './data';

// 只加载本页实际使用的真实控件，避开无关日期组件在 Node 中的扩展名解析。
vi.mock('antdv-next', async () => {
  const input = await import('antdv-next/dist/input/index');
  const number = await import('antdv-next/dist/input-number/index');
  return { Input: input.default, InputNumber: number.default };
});

const wrappers: ReturnType<typeof mount>[] = [];
afterEach(() => wrappers.splice(0).forEach((wrapper) => wrapper.unmount()));

describe('编码规则真实表单控件', () => {
  it('中文文本失焦后保留模型值，数字长度按真实详情回显', async () => {
    await initSetupVbenForm();
    const [Form, api] = useVbenForm({
      schema: formSchema(),
      showDefaultActions: false,
    });
    const wrapper = mount(Form);
    wrappers.push(wrapper);
    await flushPromises();
    await api.setValues({ name: '', code: '', prefix: '', numericLength: 6 });
    await flushPromises();
    const fields = wrapper.findAll('input');
    const [name, code, prefix, length] = fields;
    if (!name || !code || !prefix || !length)
      throw new Error('表单缺少必要控件');
    await name.setValue('管理人员');
    await name.trigger('blur');
    await code.setValue('personnel');
    await code.trigger('blur');
    await prefix.setValue('RY');
    await prefix.trigger('blur');
    await flushPromises();
    expect(await api.getValues()).toMatchObject({
      name: '管理人员',
      code: 'personnel',
      prefix: 'RY',
      numericLength: 6,
    });
    expect((name.element as HTMLInputElement).value).toBe('管理人员');
    expect((length.element as HTMLInputElement).value).toBe('6');
    const validation = await api.validate();
    expect(validation.valid).toBe(true);
    await api.setValues({
      name: '已发号规则',
      code: 'changed',
      prefix: 'NEW',
      numericLength: 8,
    });
    await flushPromises();
    expect((length.element as HTMLInputElement).value).toBe('8');
  });
});
