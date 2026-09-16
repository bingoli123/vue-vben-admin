import { DOMWrapper, flushPromises, mount } from '@vue/test-utils';
import { markRaw } from 'vue';

import { Tree } from '@vben/common-ui';

import Select from 'antdv-next/dist/select/index';
import TreeSelect from 'antdv-next/dist/tree-select/index';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ApiComponent from '../../../../../packages/effects/common-ui/src/components/api-component/api-component.vue';
import { schemaFor } from './schema';

vi.mock('#/api/request', () => ({ requestClient: {} }));
vi.mock('#/api/core/auth', () => ({ encryptPasswords: vi.fn() }));
vi.mock('#/api/system/admin', async (original) => ({
  ...(await original<object>()),
  unitOptions: vi.fn(async () => [
    { id: '1', name: '集团', enabled: true },
    { id: '2', parentId: '1', name: '下属单位', enabled: true },
  ]),
}));

afterEach(() => {
  document.body.innerHTML = '';
});

describe('系统管理原生控件回归', () => {
  it('单位筛选树只显示真实单位，不显示无文字的展开工具栏', () => {
    const wrapper = mount(Tree, {
      props: {
        treeData: [{ id: '1', name: '集团' }],
        labelField: 'name',
        valueField: 'id',
        showToolbar: false,
      },
    });
    expect(wrapper.find('.item-all-checkbox').exists()).toBe(false);
    expect(wrapper.text()).toContain('集团');
    wrapper.unmount();
  });

  it('新增用户首次展开所属单位即显示单位名称，选择后回填字符串 ID', async () => {
    const field = schemaFor('users').find(
      (item) => item.fieldName === 'unitId',
    );
    if (
      !field ||
      !('component' in field) ||
      field.component !== 'ApiTreeSelect' ||
      typeof field.componentProps !== 'object'
    )
      throw new Error('缺少单位选择器');
    const onUpdate = vi.fn();
    const wrapper = mount(ApiComponent, {
      attachTo: document.body,
      props: {
        ...(field.componentProps as Record<string, unknown>),
        component: markRaw(TreeSelect),
        fieldNames: { label: 'label', value: 'value', children: 'children' },
        modelPropName: 'value',
        optionsPropName: 'treeData',
        visibleEvent: 'onOpenChange',
        'onUpdate:value': onUpdate,
      },
    });
    await flushPromises();
    await wrapper.find('input').trigger('mousedown');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('下属单位'),
    );
    const titles = [...document.querySelectorAll('.ant-select-tree-title')];
    const child = titles.find((node) => node.textContent === '下属单位');
    expect(child).toBeTruthy();
    await new DOMWrapper(child as Element).trigger('click');
    expect(onUpdate).toHaveBeenCalledWith('2');
    wrapper.unmount();
  });

  it('新增用户性别下拉首次打开就能看到男、女选项', async () => {
    const field = schemaFor('users').find(
      (item) => item.fieldName === 'gender',
    );
    if (
      !field ||
      !('component' in field) ||
      field.component !== 'Select' ||
      typeof field.componentProps !== 'object'
    )
      throw new Error('缺少性别选择器');
    const component = Select;
    const wrapper = mount(component, {
      attachTo: document.body,
      props: {
        ...(field.componentProps as Record<string, unknown>),
        open: true,
      },
    });
    await flushPromises();
    expect(
      document.querySelector('.ant-select-dropdown')?.textContent,
    ).toContain('男');
    expect(
      document.querySelector('.ant-select-dropdown')?.textContent,
    ).toContain('女');
    wrapper.unmount();
  });
});
