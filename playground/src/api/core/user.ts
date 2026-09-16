import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';

export interface Profile {
  id: string;
  username: string;
  name: string;
  gender: null | string;
  employeeNo: string;
  unitId: string;
  unitName: string;
  locked: boolean;
  administrator: boolean;
  hasAvatar: boolean;
  version: number;
}
export interface Identity {
  userId: string;
  username: string;
  roleCodes: string[];
  administrator: boolean;
}
export const getProfile = () => requestClient.get<Profile>('/auth/profile');
export const updateProfile = (data: {
  name: string;
  gender: null | string;
  version: number;
}) => requestClient.put<Profile>('/auth/profile', data);
export const uploadAvatar = (file: File, version: number) => {
  const body = new FormData();
  body.append('file', file);
  body.append('version', String(version));
  return requestClient.post<Profile>('/auth/profile/avatar', body, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};
export const getAvatar = () =>
  requestClient.get<Blob>('/auth/profile/avatar', {
    responseType: 'blob',
    responseReturn: 'body',
  });
export async function getUserInfoApi(): Promise<
  UserInfo & { administrator: boolean; profile: Profile }
> {
  const [identity, profile] = await Promise.all([
    requestClient.get<Identity>('/auth/me'),
    getProfile(),
  ]);
  return {
    userId: identity.userId,
    username: identity.username,
    realName: profile.name || identity.username,
    roles: identity.roleCodes,
    administrator: identity.administrator,
    profile,
    avatar: '',
    desc: profile.unitName || '',
    homePath: '/dashboard',
    token: '',
  };
}
