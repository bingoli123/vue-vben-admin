import type { VxeTableGridColumns } from '#/adapter/vxe-table';
export function useColumns(): VxeTableGridColumns {
  return [
    {
      field: 'name',
      title: '名称',
      minWidth: 220,
      treeNode: true,
      slots: { default: 'name' },
    },
    {
      field: 'menuType',
      title: '类型',
      width: 90,
      slots: { default: 'menuType' },
    },
    { field: 'code', title: '菜单编码', minWidth: 140 },
    { field: 'perms', title: '权限标识', minWidth: 140 },
    { field: 'url', title: '业务页面', minWidth: 140 },
    { field: 'pageType', title: '页面用途', minWidth: 140 },
    { field: 'reportFile', title: '报表文件', minWidth: 140 },
    { field: 'sortOrder', title: '排序', minWidth: 140 },
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
