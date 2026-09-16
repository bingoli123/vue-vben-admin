import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';
import type { Personnel } from '#/api/cadre/personnel';

import { markRaw } from 'vue';

import { Input } from 'antdv-next';

/** 搜索控件沿用现有value绑定，条件在服务端先过滤后分页。 */
export const searchSchema: VbenFormSchema[] = [
  ['name', '人员名称', 200],
  ['initials', '名称简拼', 200],
  ['employeeNo', '工号', 64],
  ['number', '人员编号', 82],
].map(([fieldName, label, maxlength]) => ({
  fieldName: String(fieldName),
  label: String(label),
  component: markRaw(Input),
  modelPropName: 'value',
  componentProps: { maxlength, placeholder: `搜索${label}` },
}));
export function columns(): VxeTableGridColumns<Personnel> {
  return [
    { field: 'name', title: '人员名称', minWidth: 130 },
    { field: 'number', title: '人员编号', minWidth: 150 },
    { field: 'initials', title: '名称简拼', minWidth: 110 },
    { field: 'unitName', title: '所属单位', minWidth: 140 },
    { field: 'employeeNo', title: '工号', minWidth: 110 },
    { field: 'phone', title: '手机号', minWidth: 140 },
    { field: 'position', title: '职务', minWidth: 110 },
    { field: 'sortOrder', title: '序号', width: 80 },
    { field: 'version', title: '版本', width: 80 },
    {
      field: 'operation',
      title: '操作',
      width: 140,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
