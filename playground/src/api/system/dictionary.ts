import type { PageResult } from './admin';

import { downloadFileFromBlob } from '@vben/utils';

import { message } from 'antdv-next';

import { requestClient } from '#/api/request';

/** 主键与审计人均为字符串；表单仅发送业务白名单和读取时的版本号。 */
interface AuditedRecord {
  id: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
export interface Dictionary extends AuditedRecord {
  name: string;
  type: string;
  remark?: null | string;
}
export interface DictionaryItem extends AuditedRecord {
  dictionaryId: string;
  label: string;
  value: string;
  sortOrder: number;
  remark?: null | string;
}
export interface DictionaryCommand {
  name: string;
  type: string;
  remark?: null | string;
  version?: number;
}
export interface ItemCommand {
  label: string;
  value: string;
  sortOrder: number;
  remark?: null | string;
  version?: number;
}
const root = '/admin/dictionaries';
const itemsPath = (dictionaryId: string) => `${root}/${dictionaryId}/items`;
export const dictionaryPermission = (action: string) =>
  `platform:dictionary:${action}`;
export const itemPermission = (action: string) =>
  `platform:dictionary-item:${action}`;

async function page<T>(path: string, params: Record<string, unknown>) {
  const result = await requestClient.get<PageResult<T>>(path, { params });
  return { items: result.records, total: result.total };
}
export const getDictionaries = (params: Record<string, unknown>) =>
  page<Dictionary>(root, params);
export const getDictionary = (id: string) =>
  requestClient.get<Dictionary>(`${root}/${id}`);
export const saveDictionary = (body: DictionaryCommand, id?: string) =>
  id
    ? requestClient.put<Dictionary>(`${root}/${id}`, body)
    : requestClient.post<Dictionary>(root, body);
export const deleteDictionary = (row: Dictionary) =>
  requestClient.delete(`${root}/${row.id}`, {
    params: { version: row.version },
  });
export const getDictionaryItems = (
  dictionaryId: string,
  params: Record<string, unknown>,
) => page<DictionaryItem>(itemsPath(dictionaryId), params);
export const getDictionaryItem = (dictionaryId: string, id: string) =>
  requestClient.get<DictionaryItem>(`${itemsPath(dictionaryId)}/${id}`);
export const saveDictionaryItem = (
  dictionaryId: string,
  body: ItemCommand,
  id?: string,
) =>
  id
    ? requestClient.put<DictionaryItem>(
        `${itemsPath(dictionaryId)}/${id}`,
        body,
      )
    : requestClient.post<DictionaryItem>(itemsPath(dictionaryId), body);
export const deleteDictionaryItem = (
  dictionaryId: string,
  row: DictionaryItem,
) =>
  requestClient.delete(`${itemsPath(dictionaryId)}/${row.id}`, {
    params: { version: row.version },
  });

/** 只发送业务筛选项，不传分页；沿用统一会话、续期和 HTTP 错误处理。 */
export async function exportDictionaries(params: Record<string, unknown>) {
  await download(
    `${root}/export`,
    { name: params.name, type: params.type },
    '数据字典.xlsx',
  );
}
export async function exportDictionaryItems(
  dictionaryId: string,
  params: Record<string, unknown>,
) {
  await download(
    `${itemsPath(dictionaryId)}/export`,
    { label: params.label, value: params.value },
    '字典项.xlsx',
  );
}
async function download(
  path: string,
  params: Record<string, unknown>,
  fileName: string,
) {
  const source = await requestClient.get<Blob>(path, {
    params,
    responseType: 'blob',
    responseReturn: 'body',
  });
  // 即使代理错误地返回 200 JSON/HTML，也不触发一个伪成功的文件下载。
  if (
    source.type !==
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    source.size === 0
  ) {
    message.error('导出失败，未收到有效的 Excel 文件，请重试');
    return;
  }
  downloadFileFromBlob({ source, fileName });
}
