import type { VxeTableGridColumns } from '#/adapter/vxe-table';
export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'username', title: '账号', minWidth: 140 },
    { field: 'name', title: '姓名', minWidth: 180 },
    { field: 'state', title: '状态', width: 100, slots: { default: 'state' } },
    { field: 'phone', title: '手机号', minWidth: 140 },
    { field: 'employeeNo', title: '工号', minWidth: 140 },
    {
      field: 'gender',
      slots: { default: 'gender' },
      title: '性别',
      minWidth: 140,
    },
    { field: 'unitName', title: '所属单位', minWidth: 140 },
    {
      field: 'operation',
      title: '操作',
      width: 320,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
