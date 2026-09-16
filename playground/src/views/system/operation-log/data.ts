import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridColumns } from '#/adapter/vxe-table';

import { formatDateTime } from '@vben/utils';

import {
  deviceTypes,
  logLabel,
  logStates,
  operationTypes,
} from '#/api/system/operation-log';

export function searchSchema(): VbenFormSchema[] {
  return [
    ...[
      ['address', '操作地址', 64],
      ['module', '系统模块', 200],
      ['operator', '操作人员', 200],
      ['clientId', '客户端', 36],
    ].map(([fieldName, label, maxlength]) => ({
      component: 'Input' as const,
      fieldName: String(fieldName),
      label: String(label),
      componentProps: { maxlength: Number(maxlength), allowClear: true },
    })),
    {
      component: 'Select',
      fieldName: 'deviceType',
      label: '设备类型',
      componentProps: { options: deviceTypes, allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'browser',
      label: '浏览器',
      componentProps: { maxlength: 64, allowClear: true },
    },
    {
      component: 'Input',
      fieldName: 'operatingSystem',
      label: '操作系统',
      componentProps: { maxlength: 64, allowClear: true },
    },
    {
      component: 'Select',
      fieldName: 'operationType',
      label: '操作类型',
      componentProps: { options: operationTypes, allowClear: true },
    },
    {
      component: 'Select',
      fieldName: 'status',
      label: '状态',
      componentProps: { options: logStates, allowClear: true },
    },
    {
      component: 'RangePicker',
      fieldName: 'timeRange',
      label: '操作时间',
      formItemClass: 'col-span-2',
      componentProps: {
        showTime: true,
        valueFormat: 'YYYY-MM-DDTHH:mm:ssZ',
        class: 'w-full',
      },
    },
  ];
}
export function useColumns(selectable = false): VxeTableGridColumns {
  return [
    { type: 'checkbox', width: 44, fixed: 'left', visible: selectable },
    { field: 'id', title: '日志编号', minWidth: 110 },
    { field: 'module', title: '系统模块', minWidth: 120 },
    {
      field: 'operationType',
      title: '操作类型',
      width: 100,
      formatter: ({ cellValue }) => logLabel(operationTypes, cellValue),
    },
    {
      field: 'username',
      title: '操作账号',
      minWidth: 150,
      formatter: ({ cellValue }) => cellValue ?? '未认证',
    },
    { field: 'actorName', title: '操作人员', minWidth: 130 },
    { field: 'unitName', title: '所属单位', minWidth: 160 },
    { field: 'interfaceName', title: '接口名称', minWidth: 160 },
    { field: 'clientId', title: '客户端', minWidth: 170 },
    {
      field: 'deviceType',
      title: '设备类型',
      width: 100,
      formatter: ({ cellValue }) => logLabel(deviceTypes, cellValue),
    },
    { field: 'browser', title: '浏览器', minWidth: 110 },
    { field: 'operatingSystem', title: '操作系统', minWidth: 110 },
    { field: 'address', title: '操作地址', minWidth: 150 },
    {
      field: 'status',
      title: '操作状态',
      width: 100,
      slots: { default: 'state' },
    },
    {
      field: 'occurredAt',
      title: '操作时间',
      width: 180,
      formatter: ({ cellValue }) => formatDateTime(cellValue),
    },
    {
      field: 'operation',
      title: '操作',
      width: 90,
      fixed: 'right',
      slots: { default: 'action' },
    },
  ];
}
