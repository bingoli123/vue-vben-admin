import type { PageResult } from './admin';

import { downloadFileFromBlob } from '@vben/utils';

import { message } from 'antdv-next';

import { requestClient } from '#/api/request';

/** 日志全部为历史快照；未知字段保留空值，不用当前用户/单位信息补齐。 */
export interface OperationLog {
  id: string;
  actorId: null | string;
  username: null | string;
  actorName: null | string;
  unitId: null | string;
  unitName: null | string;
  occurredAt: string;
  module: string;
  interfaceName: string;
  operationType: string;
  status: string;
  address: null | string;
  clientId: null | string;
  deviceType: null | string;
  browser: null | string;
  operatingSystem: null | string;
  requestMethod: string;
  requestPath: string;
  httpStatus: number;
  resultCode: string;
  traceId: null | string;
  durationMs: number;
}
export const logQueryPermission = 'platform:operation-log:query';
export const logPermission = (action: string) =>
  `platform:operation-log:${action}`;
export const operationTypes = [
  { label: '登录', value: 'LOGIN' },
  { label: '退出', value: 'LOGOUT' },
  { label: '新增', value: 'CREATE' },
  { label: '修改', value: 'UPDATE' },
  { label: '导出', value: 'EXPORT' },
];
export const deviceTypes = [
  { label: '电脑', value: 'PC' },
  { label: '手机', value: 'MOBILE' },
  { label: '平板', value: 'TABLET' },
];
export const logStates = [
  { label: '成功', value: 'SUCCESS' },
  { label: '失败', value: 'FAILURE' },
];
export function logLabel(
  options: { label: string; value: string }[],
  value: null | string,
) {
  return options.find((item) => item.value === value)?.label ?? value ?? '未知';
}
/** RangePicker 返回含时区的字符串；只发送已填写条件，不把空选择传成非法枚举。 */
export function logQueryParams(
  values: Record<string, unknown>,
  page: number,
  size: number,
) {
  const { timeRange, ...fields } = values;
  const range = timeRange as string[] | undefined;
  return Object.fromEntries(
    Object.entries({
      ...fields,
      startTime: range?.[0],
      endTime: range?.[1],
      page,
      size: Math.min(size, 200),
    }).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  );
}
export async function getOperationLogs(params: Record<string, unknown>) {
  const data = await requestClient.get<PageResult<OperationLog>>(
    '/admin/operation-logs',
    { params },
  );
  return { items: data.records, total: data.total };
}
export function getOperationLog(id: string) {
  return requestClient.get<OperationLog>(`/admin/operation-logs/${id}`);
}

/** 导出沿用已提交筛选，去掉分页；只有有效 XLSX 才触发下载。 */
export async function exportOperationLogs(filters: Record<string, unknown>) {
  const {
    page: _page,
    size: _size,
    ...params
  } = logQueryParams(filters, 1, 20);
  const source = await requestClient.get<Blob>('/admin/operation-logs/export', {
    params,
    responseType: 'blob',
    responseReturn: 'body',
  });
  if (
    source.type !==
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    source.size === 0
  ) {
    message.error('导出失败，未收到有效的 Excel 文件，请重试');
    return;
  }
  downloadFileFromBlob({ source, fileName: '操作日志.xlsx' });
}
