import type { PageResult } from './admin';

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
export const operationTypes = [
  { label: '登录', value: 'LOGIN' },
  { label: '退出', value: 'LOGOUT' },
  { label: '新增', value: 'CREATE' },
  { label: '修改', value: 'UPDATE' },
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
