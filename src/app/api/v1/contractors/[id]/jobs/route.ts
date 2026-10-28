import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import {
  ensureContractorsEnabled,
  getContractorTierContext,
  sanitizeSevaContractor,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.read", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const tierCtx = await getContractorTierContext(user);

  const links = await db.sevaContractor.findMany({
    where: { contractorId: params.id },
    orderBy: { createdAt: "desc" },
    include: {
      seva: {
        select: {
          id: true,
          code: true,
          title: true,
          kind: true,
          startDate: true,
          dueDate: true,
          category: { select: { id: true, name: true } },
          area: { select: { id: true, name: true } },
        },
      },
    },
  });

  const sanitized = links.map((l) => sanitizeSevaContractor(l, tierCtx));

  return NextResponse.json(
    { data: sanitized },
    { headers: { "Cache-Control": "no-store" } }
  );
});
