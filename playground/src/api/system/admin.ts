import { encryptPasswords } from '#/api/core/auth';
import { requestClient } from '#/api/request';
export type Kind = 'menus' | 'roles' | 'units' | 'users';
export interface Row {
  id: string;
  name: string;
  version: number;
  parentId?: null | string;
  enabled?: boolean;
  administrator?: boolean;
  [key: string]: any;
}
export interface Option {
  id: string;
  name: string;
  code: string;
  parentId?: null | string;
  enabled: boolean;
  children?: Option[];
}
export interface Binding {
  version: number;
  selectedIds: string[];
  selected: Option[];
}
export interface Authorization {
  version: number;
  menuIds: string[];
  menus: Row[];
}
export interface PageResult<T> {
  records: T[];
  total: number;
  page: number;
  size: number;
}
const fields: Record<Kind, string[]> = {
  units: [
    'parentId',
    'code',
    'name',
    'category',
    'sortOrder',
    'description',
    'enabled',
  ],
  users: ['username', 'name', 'phone', 'employeeNo', 'gender', 'unitId'],
  roles: [
    'code',
    'name',
    'unitName',
    'roleType',
    'description',
    'sortOrder',
    'enabled',
  ],
  menus: [
    'parentId',
    'code',
    'perms',
    'name',
    'menuType',
    'platformType',
    'url',
    'pageType',
    'reportFile',
    'icon',
    'activeIcon',
    'resourceType',
    'operationType',
    'sortOrder',
    'description',
    'enabled',
  ],
};
export const getDetail = (kind: Kind, id: string) =>
  requestClient.get<Row>(`/admin/${kind}/${id}`);
export async function getList(
  kind: Kind,
  params: Record<string, unknown> = {},
) {
  const filtered = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== '' && v !== undefined && v !== null,
    ),
  );
  const result = await requestClient.get<PageResult<Row> | Row[]>(
    `/admin/${kind}`,
    { params: filtered },
  );
  return Array.isArray(result)
    ? result
    : { items: result.records, total: result.total };
}
export async function saveRecord(
  kind: Kind,
  values: Record<string, any>,
  existing?: Row,
) {
  const body: Record<string, any> = Object.fromEntries(
    fields[kind].map((key) => [key, values[key] === '' ? null : values[key]]),
  );
  if (existing) {
    body.version = existing.version;
  }
  if (kind === 'users' && !existing) {
    const { keyId, encrypted } = await encryptPasswords(values.password);
    Object.assign(body, { keyId, encryptedPassword: encrypted[0] });
  }
  if (kind === 'menus') {
    if (body.menuType !== 'C') body.pageType = '普通页面';
    if (body.menuType === 'F') body.code = null;
    else body.perms = null;
    if (body.pageType !== '报表查看') body.reportFile = null;
    if (body.menuType !== 'C' || body.pageType !== '普通页面') body.url = null;
  }
  return existing
    ? requestClient.put<Row>(`/admin/${kind}/${existing.id}`, body)
    : requestClient.post<Row>(`/admin/${kind}`, body);
}
export const deleteRecord = (kind: Kind, row: Row) =>
  requestClient.delete(`/admin/${kind}/${row.id}`, {
    params: { version: row.version },
  });
export const changeStatus = (kind: Kind, row: Row) =>
  kind === 'users'
    ? requestClient.put<Row>(`/admin/users/${row.id}/lock`, {
        locked: !row.locked,
        version: row.version,
      })
    : requestClient.request<Row>(`/admin/${kind}/${row.id}/status`, {
        method: 'PATCH',
        data: { enabled: !row.enabled, version: row.version },
      });
export async function resetPassword(row: Row, password: string) {
  const { keyId, encrypted } = await encryptPasswords(password);
  return requestClient.put(`/admin/users/${row.id}/password`, {
    keyId,
    encryptedPassword: encrypted[0],
    version: row.version,
  });
}
export const unitOptions = (excludeSubtreeOf?: string) =>
  requestClient.get<Option[]>('/admin/units/options', {
    params: { excludeSubtreeOf },
  });
export const menuOptions = (excludeSubtreeOf?: string) =>
  requestClient.get<Row[]>('/admin/menus/options', {
    params: { excludeSubtreeOf },
  });
export async function roleOptions() {
  const all: Option[] = [];
  let page = 1;
  while (true) {
    const result = await requestClient.get<PageResult<Option>>(
      '/admin/roles/options',
      { params: { page, size: 200 } },
    );
    all.push(...result.records);
    if (all.length >= result.total || result.records.length === 0) return all;
    page++;
  }
}
export const getUserRoles = (id: string) =>
  requestClient.get<Binding>(`/admin/users/${id}/roles`);
export const saveUserRoles = (id: string, version: number, roleIds: string[]) =>
  requestClient.put(`/admin/users/${id}/roles`, { version, roleIds });
export const getRoleMenus = (id: string) =>
  requestClient.get<Authorization>(`/admin/roles/${id}/authorization`);
export const getRoleUnits = (id: string) =>
  requestClient.get<Binding>(`/admin/roles/${id}/units`);
export const saveRoleGrants = (
  id: string,
  data: { version: number; menuIds?: string[]; unitIds?: string[] },
) => requestClient.put(`/admin/roles/${id}/grants`, data);
/** 扁平 ID 以字符串构树，缺少祖先时保留根节点；不会改变实际勾选集合。 */
export function asTree<T extends { id: string; parentId?: null | string }>(
  items: T[],
): (T & { children: T[] })[] {
  const map = new Map(
    items.map((item) => [item.id, { ...item, children: [] as T[] }]),
  );
  const roots: (T & { children: T[] })[] = [];
  for (const node of map.values()) {
    const parent = node.parentId ? map.get(node.parentId) : undefined;
    if (parent && parent !== node) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}
export function permission(kind: Kind, action: string, row?: Row) {
  let entity: string;
  if (kind === 'menus') {
    entity = row?.menuType === 'F' ? 'permission' : 'module';
  } else {
    entity = { units: 'unit', users: 'user', roles: 'role' }[kind];
  }
  return `platform:${entity}:${action}`;
}
