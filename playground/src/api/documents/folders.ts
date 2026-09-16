import { requestClient } from '#/api/request';

export interface Folder {
  id: string;
  parentId: null | string;
  unitId: string;
  unitName: string;
  name: string;
  sortOrder: number;
  description: null | string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
}
export interface FolderUnit {
  id: string;
  parentId: null | string;
  name: string;
}
export interface FolderCommand {
  parentId: null | string;
  unitId: null | string;
  name: string;
  sortOrder: number;
  description: null | string;
  version?: number;
}
const base = '/documents/folders';
export const folderPermission = (action: string) =>
  `platform:document-folder:${action}`;
export const getFolders = () => requestClient.get<Folder[]>(base);
export const getFolder = (id: string) =>
  requestClient.get<Folder>(`${base}/${id}`);
export const getFolderUnits = () =>
  requestClient.get<FolderUnit[]>(`${base}/unit-options`);
export const saveFolder = (body: FolderCommand, id?: string) =>
  id
    ? requestClient.put<Folder>(`${base}/${id}`, body)
    : requestClient.post<Folder>(base, body);
export const deleteFolder = (folder: Folder) =>
  requestClient.delete(`${base}/${folder.id}`, {
    params: { version: folder.version },
  });
