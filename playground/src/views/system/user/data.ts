import type { VxeTableGridColumns } from '#/adapter/vxe-table';
export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'username', title: '账号', minWidth: 140 },
    { field: 'name', title: '姓名', minWidth: 180 },
    { field: 'phone', title: '手机号', minWidth: 140 },
    { field: 'employeeNo', title: '工号', minWidth: 140 },
    { field: 'gender', title: '性别', minWidth: 140 },
    { field: 'unitName', title: '所属单位', minWidth: 140 },
    { field: 'fullPinyin', title: '全拼', minWidth: 140 },
    { field: 'attendanceNo', title: '考勤号', minWidth: 140 },
    { field: 'state', title: '状态', width: 100, slots: { default: 'state' } },
    {
      field: 'operation',
      title: '操作',
      width: 230,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
