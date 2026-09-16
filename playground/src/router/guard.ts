import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { useAccessStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { useAuthStore } from '#/store';

import { generateAccess } from './access';

function createRouterGuard(router: Router) {
  router.beforeEach(async (to) => {
    if (preferences.transition.progress) startProgress();
    const access = useAccessStore();
    const auth = useAuthStore();
    if (to.path === '/login') return LOGIN_PATH;
    if (to.path === LOGIN_PATH) return access.accessToken ? '/dashboard' : true;
    if (!access.accessToken)
      return { path: LOGIN_PATH, query: { redirect: to.fullPath } };
    if (!access.isAccessChecked) {
      const token = access.accessToken;
      try {
        const info = await auth.fetchUserInfo();
        const result = await generateAccess({
          roles: info.roles,
          router,
          routes: [],
        });
        if (access.accessToken !== token) return LOGIN_PATH;
        access.setAccessMenus(result.accessibleMenus);
        access.setAccessRoutes(result.accessibleRoutes);
        access.setIsAccessChecked(true);
        return {
          path: to.fullPath === '/' ? '/dashboard' : to.fullPath,
          replace: true,
        };
      } catch {
        // 暂时依赖故障保留身份；只有请求层确认 401 才清除会话。
        return access.accessToken ? false : LOGIN_PATH;
      }
    }
    return true;
  });
  router.afterEach(() => stopProgress());
  router.onError(() => stopProgress());
}
export { createRouterGuard };
