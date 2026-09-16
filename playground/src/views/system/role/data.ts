import type { VxeTableGridColumns } from '#/adapter/vxe-table';
export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: '角色名称', minWidth: 180 },
    { field: 'code', title: '角色编码', minWidth: 140 },
    { field: 'state', title: '状态', width: 130, slots: { default: 'state' } },
    { field: 'unitName', title: '所属单位', minWidth: 140 },
    { field: 'roleType', title: '角色类型', minWidth: 140 },
    { field: 'description', title: '说明', minWidth: 140 },
    {
      field: 'operation',
      title: '操作',
      width: 230,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
