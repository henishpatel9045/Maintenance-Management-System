export interface AreaItem {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  parent?: { id: string; name: string } | null;
  _count?: {
    children: number;
    sevas: number;
    sevaRequests: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

export function buildAreaPath(
  areaId: string,
  areasMap: Map<string, { id: string; name: string; parentId: string | null }>,
  visited = new Set<string>()
): string {
  if (visited.has(areaId)) return "";
  visited.add(areaId);

  const item = areasMap.get(areaId);
  if (!item) return "";

  if (item.parentId && areasMap.has(item.parentId)) {
    const parentPath = buildAreaPath(item.parentId, areasMap, visited);
    return parentPath ? `${parentPath} → ${item.name}` : item.name;
  }

  return item.name;
}

export function getAreaDescendantIds(
  areaId: string,
  areas: Array<{ id: string; parentId: string | null }>
): Set<string> {
  const descendants = new Set<string>();

  function collect(id: string) {
    for (const a of areas) {
      if (a.parentId === id && !descendants.has(a.id)) {
        descendants.add(a.id);
        collect(a.id);
      }
    }
  }

  collect(areaId);
  return descendants;
}
