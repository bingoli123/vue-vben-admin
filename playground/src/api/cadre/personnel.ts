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
/** 编号、规则ID、状态、身份及审计均不可回写；空文本保存NULL，序号0原样保留。 */
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
