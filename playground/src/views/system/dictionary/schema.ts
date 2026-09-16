import type { VbenFormSchema } from '#/adapter/form';

import { z } from '#/adapter/form';

/** 字典类型与键值都允许修改；只校验格式和长度，不增加业务引用限制。 */
export function editorSchema(item: boolean): VbenFormSchema[] {
  const fields = item
    ? [
        { fieldName: 'label', label: '字典标签', max: 200 },
        { fieldName: 'value', label: '字典键值', max: 64 },
      ]
    : [
        { fieldName: 'name', label: '字典名称', max: 200 },
        { fieldName: 'type', label: '字典类型', max: 64 },
      ];
  const schema: VbenFormSchema[] = fields.map(({ fieldName, label, max }) => ({
    fieldName,
    label,
    component: 'Input',
    componentProps: { maxlength: max, placeholder: `请输入${label}` },
    rules: z.string().trim().min(1, `请填写${label}`).max(max),
  }));
  if (item)
    schema.push({
      fieldName: 'sortOrder',
      label: '排序',
      component: 'InputNumber',
      defaultValue: 0,
      componentProps: {
        min: 0,
        max: 2_147_483_647,
        precision: 0,
        class: 'w-full',
      },
      rules: z.number().int().min(0).max(2_147_483_647),
    });
  schema.push({
    fieldName: 'remark',
    label: '备注',
    component: 'Textarea',
    componentProps: { maxlength: 1000, rows: 4, placeholder: '请输入备注' },
  });
  return schema;
}

export function searchSchema(item: boolean): VbenFormSchema[] {
  return (
    item
      ? [
          { fieldName: 'label', label: '字典标签' },
          { fieldName: 'value', label: '字典键值' },
        ]
      : [
          { fieldName: 'name', label: '字典名称' },
          { fieldName: 'type', label: '字典类型' },
        ]
  ).map(({ fieldName, label }) => ({
    fieldName,
    label,
    component: 'Input',
    componentProps: {
      allowClear: true,
      maxlength: fieldName === 'type' || fieldName === 'value' ? 64 : 200,
      placeholder: `搜索${label}`,
    },
  }));
}
