import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.readFull", async (req, { params }) => {
  await ensureContractorsEnabled();

  const quotes = await db.sevaFile.findMany({
    where: {
      contractorId: params.id,
      bucket: "QUOTE",
      deletedAt: null,
    },
    orderBy: { createdAt: "desc" },
    include: {
      seva: {
        select: {
          id: true,
          code: true,
          title: true,
        },
      },
      fileObject: true,
      approvedBy: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ data: quotes }, { headers: { "Cache-Control": "no-store" } });
});
