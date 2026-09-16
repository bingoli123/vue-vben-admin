import type { NavigationMenu } from './menu';

import { describe, expect, it, vi } from 'vitest';

import { navigationRoutes } from './menu';

vi.mock('#/api/request', () => ({ requestClient: {} }));
const node = (
  id: string,
  extra: Partial<NavigationMenu> = {},
): NavigationMenu => ({
  id,
  name: id,
  menuType: 'C',
  pageType: '普通页面',
  accessible: true,
  enabled: true,
  sortOrder: 0,
  children: [],
  url: '/admin/users',
  ...extra,
});
describe('后端菜单投影', () => {
  it('按钮权限不会变成页面，未知地址不执行任意组件', () => {
    expect(
      navigationRoutes([
        node('1', { menuType: 'F' }),
        node('2', { url: 'https://example.com' }),
        node('3', { enabled: false }),
      ]),
    ).toEqual([]);
  });
  it('可见祖先不提升为业务访问，同一组件的入口保持独立身份', () => {
    const result = navigationRoutes([
      node('1', {
        menuType: 'M',
        accessible: false,
        children: [node('2'), node('3')],
      }),
    ]);
    expect(result[0]?.children?.map((route) => route.name)).toEqual([
      'Menu2',
      'Menu3',
    ]);
    expect(result[0]?.component).toBe('BasicLayout');
    expect(navigationRoutes([node('4', { accessible: false })])).toEqual([]);
  });
  it('没有 url 的报表可打开，图标与激活图标分开投影', () => {
    const route = navigationRoutes([
      node('5', {
        url: undefined,
        pageType: '报表查看',
        icon: 'TeamOutlined',
        activeIcon: 'lucide:user-check',
      }),
    ])[0];
    expect(route?.component).toBe('/reports/index');
    expect(route?.meta).toMatchObject({
      menuId: '5',
      icon: 'lucide:users',
      activeIcon: 'lucide:user-check',
    });
  });
});
