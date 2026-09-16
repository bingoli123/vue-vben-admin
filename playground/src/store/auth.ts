import type { Recordable } from '@vben/types';

import { ref } from 'vue';
import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

import { defineStore } from 'pinia';

import {
  getAccessCodesApi,
  getAvatar,
  getUserInfoApi,
  loginApi,
  logoutApi,
} from '#/api';
import { resetRoutes } from '#/router';

export const useAuthStore = defineStore('auth', () => {
  const access = useAccessStore();
  const users = useUserStore();
  const router = useRouter();
  const loginLoading = ref(false);
  const expiresAt = ref(0);
  let generation = 0;
  let avatarUrl = '';
  function setExpiresAt(value: number) {
    expiresAt.value = value;
  }
  async function refreshAvatar() {
    const token = access.accessToken;
    const profile = users.userInfo?.profile as
      | undefined
      | { hasAvatar?: boolean };
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    avatarUrl = '';
    if (profile?.hasAvatar) {
      const blob = await getAvatar();
      if (token !== access.accessToken) return;
      avatarUrl = URL.createObjectURL(blob);
    }
    if (users.userInfo)
      users.setUserInfo({ ...users.userInfo, avatar: avatarUrl });
  }
  async function fetchUserInfo() {
    const token = access.accessToken;
    const current = generation;
    const [info, grants] = await Promise.all([
      getUserInfoApi(),
      getAccessCodesApi(),
    ]);
    if (token !== access.accessToken || current !== generation)
      throw new Error('会话已变更');
    users.setUserInfo(info);
    // 管理员来自后端固定身份标记，不从角色名称推断。
    access.setAccessCodes(
      grants.administrator
        ? ['__xk_administrator__', ...grants.permissions]
        : grants.permissions,
    );
    try {
      await refreshAvatar();
    } catch {
      /* 头像存储短时故障不阻止有效账号登录。 */
    }
    return info;
  }
  async function clearSession(redirect = true) {
    generation++;
    if (avatarUrl) URL.revokeObjectURL(avatarUrl);
    avatarUrl = '';
    const path = router.currentRoute.value.fullPath;
    resetAllStores();
    resetRoutes();
    await router.replace({
      path: LOGIN_PATH,
      query: redirect && !path.startsWith('/auth') ? { redirect: path } : {},
    });
  }
  async function authLogin(
    params: Recordable<any>,
    onSuccess?: () => Promise<void> | void,
  ) {
    loginLoading.value = true;
    try {
      const result = await loginApi({
        username: params.username,
        password: params.password,
        captchaToken: params.captchaToken,
      });
      access.setAccessToken(result.token);
      setExpiresAt(Date.now() + result.expiresIn * 1000);
      access.setIsAccessChecked(false);
      resetRoutes();
      const userInfo = await fetchUserInfo();
      const redirect = router.currentRoute.value.query.redirect;
      await (onSuccess
        ? onSuccess()
        : router.replace(
            typeof redirect === 'string' &&
              redirect.startsWith('/') &&
              !redirect.startsWith('//') &&
              !redirect.startsWith('/auth')
              ? redirect
              : '/dashboard',
          ));
      return { userInfo };
    } catch (error) {
      if (access.accessToken) await clearSession(false);
      throw error;
    } finally {
      loginLoading.value = false;
    }
  }
  async function logout(redirect = true) {
    try {
      if (access.accessToken) await logoutApi();
    } finally {
      await clearSession(redirect);
    }
  }
  function $reset() {
    loginLoading.value = false;
    expiresAt.value = 0;
  }
  return {
    $reset,
    authLogin,
    clearSession,
    expiresAt,
    fetchUserInfo,
    loginLoading,
    logout,
    refreshAvatar,
    setExpiresAt,
  };
});
