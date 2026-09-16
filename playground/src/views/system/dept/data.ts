import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

export function useColumns(): VxeTableGridColumns {
  return [
    { field: 'name', title: '单位名称', minWidth: 180, treeNode: true },
    { field: 'state', title: '状态', width: 100, slots: { default: 'state' } },
    {
      field: 'createdAt',
      title: '创建时间',
      width: 170,
      formatter: ({ cellValue }) => formatDateTime(cellValue),
    },
    { field: 'code', title: '单位编码', minWidth: 140 },
    {
      field: 'category',
      slots: { default: 'category' },
      title: '单位类别',
      minWidth: 140,
    },
    { field: 'sortOrder', title: '排序', minWidth: 140 },
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
