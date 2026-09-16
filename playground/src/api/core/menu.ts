import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';
export interface NavigationMenu {
  id: string;
  name: string;
  url?: string;
  icon?: string;
  activeIcon?: string;
  menuType: 'C' | 'F' | 'M';
  pageType: string;
  accessible: boolean;
  enabled: boolean;
  sortOrder: number;
  children: NavigationMenu[];
}
const pages: Record<string, string> = {
  '/documents': '/documents/index',
  '/admin/operation-logs': '/system/operation-log/list',
  '/admin/users': '/system/user/list',
  '/admin/units': '/system/dept/list',
  '/admin/roles': '/system/role/list',
  '/admin/menus': '/system/menu/list',
  '/reports/designer': '/reports/index',
};
const legacyIcons: Record<string, string> = {
  TeamOutlined: 'lucide:users',
  ApartmentOutlined: 'lucide:network',
  SafetyCertificateOutlined: 'lucide:shield-check',
  AppstoreOutlined: 'lucide:layout-grid',
  SettingOutlined: 'lucide:settings',
};
export function menuIcon(icon?: string) {
  return icon ? legacyIcons[icon] || icon : undefined;
}
/** 仅映射已实现页面；菜单 ID 决定路由身份，同一页面可有多个独立授权入口。 */
export function navigationRoutes(
  nodes: NavigationMenu[],
): RouteRecordStringComponent[] {
  return nodes
    .filter((n) => n.enabled && n.menuType !== 'F')
    .flatMap<RouteRecordStringComponent>((n) => {
      const children = navigationRoutes(n.children ?? []);
      if (n.menuType === 'M') {
        if (children.length === 0) return [];
        return [
          {
            name: `Menu${n.id}`,
            path: `/menus/${n.id}`,
            component: 'BasicLayout',
            meta: {
              title: n.name,
              icon: menuIcon(n.icon),
              activeIcon: menuIcon(n.activeIcon),
              order: n.sortOrder,
            },
            redirect: children[0]?.path,
            children,
          },
        ];
      }
      if (!n.accessible) return [];
      let component: string | undefined;
      if (n.pageType === '报表查看') {
        component = '/reports/index';
      } else if (n.pageType === '普通页面') {
        component = pages[n.url ?? ''];
      }
      if (!component) return [];
      return [
        {
          name: `Menu${n.id}`,
          path: `/menus/${n.id}`,
          component,
          meta: {
            title: n.name,
            icon: menuIcon(n.icon),
            activeIcon: menuIcon(n.activeIcon),
            menuId: n.id,
            order: n.sortOrder,
          },
        },
      ];
    });
}
export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const menus = await requestClient.get<NavigationMenu[]>('/auth/menus');
  return [
    {
      name: 'Dashboard',
      path: '/dashboard',
      component: '/dashboard/index',
      meta: {
        title: '仪表盘',
        icon: 'lucide:layout-dashboard',
        affixTab: true,
        order: -1,
      },
    },
    ...navigationRoutes(menus),
    {
      name: 'Profile',
      path: '/profile',
      component: '/_core/profile/index',
      meta: { title: '个人中心', icon: 'lucide:user', hideInMenu: true },
    },
  ];
}
