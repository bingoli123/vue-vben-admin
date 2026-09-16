import { describe, expect, it } from 'vitest';

import { filterUnitsByCategory } from './filter';
const rows = [
  { id: '1', name: '集团', version: 0, category: null },
  { id: '2', parentId: '1', name: '矿', version: 0, category: 'mine' },
  { id: '3', parentId: '1', name: '部门', version: 0, category: 'department' },
  { id: '4', parentId: '3', name: '旧分类', version: 0, category: '222' },
];
describe('单位类别树筛选', () => {
  it('按键值匹配，仅保留匹配单位和其祖先', () => {
    expect(filterUnitsByCategory(rows, 'mine').map((row) => row.id)).toEqual([
      '1',
      '2',
    ]);
    expect(filterUnitsByCategory(rows, '222').map((row) => row.id)).toEqual([
      '1',
      '3',
      '4',
    ]);
    expect(filterUnitsByCategory(rows, '')).toEqual(rows);
    expect(filterUnitsByCategory(rows, 'missing')).toEqual([]);
  });
});
