import type { PageResult } from '#/api/system/admin';

import { downloadFileFromBlob } from '@vben/utils';

import { message } from 'antdv-next';

import { requestClient } from '#/api/request';

/** 文件业务归属与上传人历史单位分别显示；存储键不属于公开接口。 */
export interface DocumentFile {
  id: string;
  folderId: string;
  unitId: string;
  name: string;
  extension: null | string;
  size: number;
  contentType: string;
  sha256: null | string;
  category: null | string;
  uploaderId: string;
  uploaderName: string;
  uploaderUnitId: null | string;
  uploaderUnitName: null | string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  version: number;
}
export interface FileQuery {
  folderId: string;
  name?: string;
  fileCategory?: string;
  page: number;
  size: number;
}
const base = '/documents/files';
export const filePermission = (action: string) =>
  `platform:document-file:${action}`;
export const getFiles = (params: FileQuery) =>
  requestClient.get<PageResult<DocumentFile>>(base, { params });
export const getFile = (id: string) =>
  requestClient.get<DocumentFile>(`${base}/${id}`);
export const uploadFile = (folderId: string, file: File, category: string) => {
  const body = new FormData();
  body.append('folderId', folderId);
  body.append('file', file);
  if (category.trim()) body.append('fileCategory', category.trim());
  return requestClient.post<DocumentFile>(base, body, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120_000,
  });
};

/** 真实鉴权流沿用会话客户端；失败响应不会被保存为损坏的附件。 */
export async function downloadFile(file: DocumentFile) {
  try {
    const blob = await requestClient.get<Blob>(`${base}/${file.id}/download`, {
      responseType: 'blob',
      responseReturn: 'body',
      timeout: 120_000,
    });
    if (!(blob instanceof Blob) || blob.type.includes('json')) {
      throw new Error('下载未返回原文件，请重试');
    }
    downloadFileFromBlob({ source: blob, fileName: file.name });
  } catch (error) {
    // Blob模式下仍读取服务端中文业务错误；401清会话继续由统一客户端处理。
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (data instanceof Blob && data.type.includes('json')) {
      try {
        const body: { message?: string } = JSON.parse(await data.text());
        if (body.message) message.error(body.message);
      } catch {
        /* 非JSON的网关错误沿用客户端提示。 */
      }
    } else if (
      error instanceof Error &&
      error.message === '下载未返回原文件，请重试'
    ) {
      message.error(error.message);
    }
    throw error;
  }
}
