import { addCollection } from '@vben/icons';

import { icons } from '@iconify-json/lucide';

/** 图标名称和 SVG 随应用一起发布，菜单及原生选择器无需访问外部 Iconify 服务。 */
export function registerAppIcons() {
  addCollection(icons);
}
