import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { computeRollup } from "@/modules/seva/hierarchy";

export const runtime = "nodejs";

export interface SevaTreeNode {
  id: string;
  code: string;
  title: string;
  isGroup: boolean;
  priority: string;
  depth: number;
  sortOrder: number;
  parentId: string | null;
  category: { id: string; name: string; color: string };
  area: { id: string; name: string };
  progressPercent?: number;
  childrenCount: number;
  children: SevaTreeNode[];
}

export const GET = withAuth("seva.read", async (req) => {
  const url = new URL(req.url);
  const rootId = url.searchParams.get("rootId");

  let pathWhere = {};
  if (rootId) {
    const root = await db.seva.findUnique({ where: { id: rootId }, select: { path: true } });
    if (root) {
      pathWhere = { OR: [{ id: rootId }, { path: { startsWith: root.path } }] };
    }
  }

  const allSevas = await db.seva.findMany({
    where: {
      isArchived: false,
      ...pathWhere,
    },
    include: {
      category: { select: { id: true, name: true, color: true } },
      area: { select: { id: true, name: true } },
      _count: { select: { children: true } },
    },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const nodeMap = new Map<string, SevaTreeNode>();
  allSevas.forEach((s) => {
    nodeMap.set(s.id, {
      id: s.id,
      code: s.code,
      title: s.title,
      isGroup: s.isGroup,
      priority: s.priority,
      depth: s.depth,
      sortOrder: s.sortOrder,
      parentId: s.parentId,
      category: s.category,
      area: s.area,
      childrenCount: s._count.children,
      children: [],
    });
  });

  const roots: SevaTreeNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return NextResponse.json({ data: roots });
});
