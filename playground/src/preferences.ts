import { defineOverridesPreferences } from '@vben/preferences';

/** 使用原生布局、主题和标签页；导航及权限统一来自后端。 */
export const overridesPreferences = defineOverridesPreferences({
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    accessMode: 'backend',
    defaultHomePath: '/dashboard',
    enableRefreshToken: false,
    loginExpiredMode: 'page',
  },
  widget: { notification: false, notificationButtonPosition: 'none' },
  theme: { mode: 'light' },
  copyright: { enable: false },
});
