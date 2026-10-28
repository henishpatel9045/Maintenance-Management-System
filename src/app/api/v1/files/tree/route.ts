import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

export interface FileTreeFolder {
  id: string;
  code: string;
  title: string;
  parentId: string | null;
  depth: number;
  quotesCount: number;
  quotesSizeBytes: string;
  artefactsCount: number;
  artefactsSizeBytes: string;
  totalSizeBytes: string;
  children: FileTreeFolder[];
}

export const GET = withAuth("seva.read", async (_req, { user }) => {
  const canViewQuotes = can(user, "quotes.view");

  const sevas = await db.seva.findMany({
    where: { isArchived: false },
    select: {
      id: true,
      code: true,
      title: true,
      parentId: true,
      depth: true,
      sortOrder: true,
      files: {
        where: { deletedAt: null },
        select: {
          bucket: true,
          fileObject: { select: { sizeBytes: true } },
        },
      },
    },
    orderBy: [{ depth: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const nodeMap = new Map<string, FileTreeFolder>();

  for (const s of sevas) {
    let quotesCount = 0;
    let quotesBytes = BigInt(0);
    let artefactsCount = 0;
    let artefactsBytes = BigInt(0);

    for (const f of s.files) {
      if (f.bucket === "QUOTE") {
        if (canViewQuotes) {
          quotesCount++;
          quotesBytes += f.fileObject.sizeBytes;
        }
      } else {
        artefactsCount++;
        artefactsBytes += f.fileObject.sizeBytes;
      }
    }

    const totalBytes = quotesBytes + artefactsBytes;

    nodeMap.set(s.id, {
      id: s.id,
      code: s.code,
      title: s.title,
      parentId: s.parentId,
      depth: s.depth,
      quotesCount,
      quotesSizeBytes: quotesBytes.toString(),
      artefactsCount,
      artefactsSizeBytes: artefactsBytes.toString(),
      totalSizeBytes: totalBytes.toString(),
      children: [],
    });
  }

  const roots: FileTreeFolder[] = [];
  nodeMap.forEach((node) => {
    if (node.parentId && nodeMap.has(node.parentId)) {
      nodeMap.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return NextResponse.json({ data: roots });
});
