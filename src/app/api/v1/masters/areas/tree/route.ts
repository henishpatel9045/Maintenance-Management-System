import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";

export const runtime = "nodejs";

export interface AreaTreeNode {
  id: string;
  name: string;
  parentId: string | null;
  sortOrder: number;
  children: AreaTreeNode[];
  _count?: {
    children: number;
    sevas: number;
    sevaRequests: number;
  };
}

export const GET = withAuth({}, async () => {
  const allAreas = await db.area.findMany({
    include: {
      _count: {
        select: {
          children: true,
          sevas: true,
          sevaRequests: true,
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const nodeMap = new Map<string, AreaTreeNode>();
  allAreas.forEach((a) => {
    nodeMap.set(a.id, {
      id: a.id,
      name: a.name,
      parentId: a.parentId,
      sortOrder: a.sortOrder,
      children: [],
      _count: a._count,
    });
  });

  const roots: AreaTreeNode[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return NextResponse.json({ data: roots });
});
