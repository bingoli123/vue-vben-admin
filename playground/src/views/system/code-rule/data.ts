import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { CodeRule } from '#/api/system/code-rule';

import { markRaw } from 'vue';

import { Input, InputNumber } from 'antdv-next';

import { z } from '#/adapter/form';

// 本页直接绑定 value：避开注册控件包装路径的文本失焦丢值和数字回显异常。
export const searchSchema: VbenFormSchema[] = [
  {
    component: markRaw(Input),
    modelPropName: 'value',
    fieldName: 'name',
    label: '业务名称',
    componentProps: { maxlength: 200 },
  },
  {
    component: markRaw(Input),
    modelPropName: 'value',
    fieldName: 'code',
    label: '业务标识',
    componentProps: { maxlength: 64 },
  },
];
export function formSchema(existing?: CodeRule): VbenFormSchema[] {
  const min =
    existing && existing.currentSequence !== '0' ? existing.numericLength : 1;
  return [
    {
      component: markRaw(Input),
      modelPropName: 'value',
      fieldName: 'name',
      label: '业务名称',
      componentProps: { maxlength: 200 },
      rules: z.string().trim().min(1, '请填写业务名称').max(200),
    },
    {
      component: markRaw(Input),
      modelPropName: 'value',
      fieldName: 'code',
      label: '业务标识',
      componentProps: { maxlength: 64 },
      rules: z.string().trim().min(1, '请填写业务标识').max(64),
    },
    {
      component: markRaw(Input),
      modelPropName: 'value',
      fieldName: 'prefix',
      label: '业务前缀',
      componentProps: { maxlength: 64, placeholder: '可留空' },
    },
    {
      component: markRaw(InputNumber),
      modelPropName: 'value',
      fieldName: 'numericLength',
      label: '数字长度',
      componentProps: { min, max: 18, precision: 0 },
      rules: z.number().int().min(min, `数字长度不能小于 ${min}`).max(18),
      help: '仅计算数字段，范围 1–18 位；已发号后只能加长。',
    },
  ];
}
export function columns(): VxeTableGridColumns<CodeRule> {
  return [
    { field: 'name', title: '业务名称', minWidth: 170 },
    { field: 'code', title: '业务标识', minWidth: 170 },
    { field: 'prefix', title: '业务前缀', minWidth: 110 },
    { field: 'numericLength', title: '数字长度', width: 110 },
    {
      field: 'currentSerial',
      title: '当前已发流水号',
      minWidth: 195,
      slots: { default: 'progress' },
    },
    { field: 'version', title: '版本', width: 90 },
    {
      field: 'operation',
      title: '操作',
      width: 210,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
