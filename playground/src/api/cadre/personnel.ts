import type { Option, PageResult } from '#/api/system/admin';

import { requestClient } from '#/api/request';

export interface Personnel {
  id: string;
  unitId: string;
  unitName: string;
  name: string;
  number: string;
  ruleId: string;
  initials: null | string;
  employeeNo: null | string;
  phone: null | string;
  position: null | string;
  sortOrder: null | number;
  undergroundCount: null | number;
  onsiteCount: null | number;
  watchDutyCount: null | number;
  stopWorkCount: null | number;
  dCardCount: null | number;
  penaltyAmount: null | string;
  safetySalary: null | string;
  salaryCoefficient: null | string;
  enabled: boolean;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
export const personnelPermission = (action: string) =>
  `cadre:personnel:${action}`;
export const getPersonnel = (id: string) =>
  requestClient.get<Personnel>(`/cadre/personnel/${id}`);
export const getPersonnelUnits = () =>
  requestClient.get<Option[]>('/cadre/personnel/units');
export const suggestInitials = (name: string) =>
  requestClient.get<string>('/cadre/personnel/initials', { params: { name } });
export const changePersonnelStatus = (
  record: Pick<Personnel, 'enabled' | 'id' | 'version'>,
) =>
  requestClient.request<Personnel>(`/cadre/personnel/${record.id}/status`, {
    method: 'PATCH',
    data: { enabled: !record.enabled, version: record.version },
  });
export async function getPersonnelList(params: Record<string, unknown> = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  );
  const result = await requestClient.get<PageResult<Personnel>>(
    '/cadre/personnel',
    { params: filtered },
  );
  return { items: result.records, total: result.total };
}
/** 编号、状态及审计不可随资料回写；空值保存NULL，数值0原样保留。 */
export function savePersonnel(
  values: Record<string, unknown>,
  existing?: Pick<Personnel, 'id' | 'version'>,
) {
  const fields = [
    'unitId',
    'name',
    'initials',
    'employeeNo',
    'phone',
    'position',
    'sortOrder',
    'undergroundCount',
    'onsiteCount',
    'watchDutyCount',
    'stopWorkCount',
    'dCardCount',
    'penaltyAmount',
    'safetySalary',
    'salaryCoefficient',
  ];
  const body = Object.fromEntries(
    fields.map((key) => [
      key,
      values[key] === '' || values[key] === undefined ? null : values[key],
    ]),
  );
  if (existing) body.version = existing.version;
  return existing
    ? requestClient.put<Personnel>(`/cadre/personnel/${existing.id}`, body)
    : requestClient.post<Personnel>('/cadre/personnel', body);
}
