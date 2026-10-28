import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";

export const runtime = "nodejs";

export const GET = withAuth("settings.manage", async () => {
  // Aggregate total storage across all non-deleted file objects
  const totalFiles = await db.fileObject.findMany({
    where: { deletedAt: null },
    select: { sizeBytes: true },
  });

  let totalSizeBytes = BigInt(0);
  for (const f of totalFiles) {
    totalSizeBytes += f.sizeBytes;
  }

  // Storage usage per seva (top 20 consumers)
  const sevaFiles = await db.sevaFile.findMany({
    where: { deletedAt: null },
    select: {
      sevaId: true,
      seva: { select: { code: true, title: true } },
      fileObject: { select: { sizeBytes: true } },
    },
  });

  const sevaUsageMap = new Map<string, { code: string; title: string; count: number; bytes: bigint }>();

  for (const sf of sevaFiles) {
    const entry = sevaUsageMap.get(sf.sevaId) || {
      code: sf.seva.code,
      title: sf.seva.title,
      count: 0,
      bytes: BigInt(0),
    };
    entry.count++;
    entry.bytes += sf.fileObject.sizeBytes;
    sevaUsageMap.set(sf.sevaId, entry);
  }

  const perSevaUsage = Array.from(sevaUsageMap.entries())
    .map(([sevaId, data]) => ({
      sevaId,
      code: data.code,
      title: data.title,
      filesCount: data.count,
      sizeBytes: data.bytes.toString(),
      sizeMB: (Number(data.bytes) / (1024 * 1024)).toFixed(2),
    }))
    .sort((a, b) => Number(b.sizeBytes) - Number(a.sizeBytes));

  return NextResponse.json({
    data: {
      totalFilesCount: totalFiles.length,
      totalSizeBytes: totalSizeBytes.toString(),
      totalSizeMB: (Number(totalSizeBytes) / (1024 * 1024)).toFixed(2),
      perSevaUsage: perSevaUsage.slice(0, 25),
    },
  });
});
