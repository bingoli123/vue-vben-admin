import { defineOverridesPreferences } from '@vben/preferences';

/** 已移除的功能：初始化后同样覆盖旧缓存，避免历史偏好重新启用入口。 */
export const removedFeaturePreferences = defineOverridesPreferences({
  shortcutKeys: { globalLockScreen: false, globalSearch: false },
  widget: {
    globalSearch: false,
    globalSearchButtonPosition: 'none',
    languageToggle: false,
    languageToggleButtonPosition: 'none',
    lockScreen: false,
    lockScreenButtonPosition: 'none',
    notification: false,
    notificationButtonPosition: 'none',
    timezone: false,
    timezoneButtonPosition: 'none',
  },
});

/** 使用原生布局、主题和标签页；导航及权限统一来自后端。 */
export const overridesPreferences = defineOverridesPreferences({
  ...removedFeaturePreferences,
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    accessMode: 'backend',
    defaultHomePath: '/dashboard',
    enableRefreshToken: false,
    loginExpiredMode: 'page',
  },
  theme: { mode: 'light' },
  copyright: { enable: false },
});
