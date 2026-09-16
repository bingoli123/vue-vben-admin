import type { Row } from '#/api/system/admin';

/** 筛选树时保留匹配节点的祖先作为层级上下文，不把同级或无关后代混入结果。 */
export function filterUnitsByCategory(rows: Row[], category: unknown): Row[] {
  if (category === null || category === undefined || category === '')
    return rows;
  const index = new Map(rows.map((row) => [row.id, row]));
  const visible = new Set<string>();
  for (const row of rows) {
    if (row.category !== category) continue;
    let current: Row | undefined = row;
    while (current && !visible.has(current.id)) {
      visible.add(current.id);
      current = current.parentId ? index.get(current.parentId) : undefined;
    }
  }
  return rows.filter((row) => visible.has(row.id));
}
