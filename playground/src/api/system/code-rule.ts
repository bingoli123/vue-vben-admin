import type { PageResult } from './admin';

import { requestClient } from '#/api/request';

export interface CodeRule {
  id: string;
  name: string;
  code: string;
  prefix: null | string;
  numericLength: number;
  currentSequence: string;
  currentSerial: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}
export const codeRulePermission = (action: string) =>
  `platform:code-rule:${action}`;
export async function getCodeRules(params: Record<string, unknown> = {}) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== '' && value !== null && value !== undefined,
    ),
  );
  const result = await requestClient.get<PageResult<CodeRule>>(
    '/admin/code-rules',
    { params: filtered },
  );
  return { items: result.records, total: result.total };
}
export const getCodeRule = (id: string) =>
  requestClient.get<CodeRule>(`/admin/code-rules/${id}`);

/** 仅提交格式字段，防止详情里的累计进度或审计字段随表单回写。 */
export function saveCodeRule(
  values: Record<string, unknown>,
  existing?: Pick<CodeRule, 'id' | 'version'>,
) {
  const body = {
    name: values.name,
    code: values.code,
    prefix: values.prefix || null,
    numericLength: values.numericLength,
    ...(existing ? { version: existing.version } : {}),
  };
  return existing
    ? requestClient.put<CodeRule>(`/admin/code-rules/${existing.id}`, body)
    : requestClient.post<CodeRule>('/admin/code-rules', body);
}
export const deleteCodeRule = (row: Pick<CodeRule, 'id' | 'version'>) =>
  requestClient.delete(`/admin/code-rules/${row.id}`, {
    params: { version: row.version },
  });
