/** 单位授权可能不包含祖先，候选树将缺失祖先的授权节点提升为根，且不补出越权名称。 */
export interface TreeItem {
  id: string;
  parentId: null | string;
  name: string;
}
export interface FolderTreeNode {
  key: string;
  value: string;
  title: string;
  children: FolderTreeNode[];
}
export function folderTree(rows: TreeItem[]): FolderTreeNode[] {
  const nodes = new Map(
    rows.map((row) => [
      row.id,
      {
        key: row.id,
        value: row.id,
        title: row.name,
        children: [],
      } as FolderTreeNode,
    ]),
  );
  const roots: FolderTreeNode[] = [];
  for (const row of rows) {
    const node = nodes.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? nodes.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  return roots;
}

/** 编辑不能选择自身或后代；后端仍独立检查完整层级和单位，前端只提供有效候选。 */
export function folderDescendants(rows: TreeItem[], id?: string): Set<string> {
  const excluded = new Set<string>(id ? [id] : []);
  let changed: boolean;
  do {
    changed = false;
    for (const row of rows) {
      if (row.parentId && excluded.has(row.parentId) && !excluded.has(row.id)) {
        excluded.add(row.id);
        changed = true;
      }
    }
  } while (changed);
  return excluded;
}
