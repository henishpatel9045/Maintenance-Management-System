import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { ensureContractorsEnabled } from "@/modules/contractors";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.readFull", async (req, { params }) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const where: Prisma.SevaContractorWhereInput = {
    contractorId: params.id,
  };

  if (fromParam || toParam) {
    where.createdAt = {};
    if (fromParam) where.createdAt.gte = new Date(fromParam);
    if (toParam) where.createdAt.lte = new Date(toParam);
  }

  const links = await db.sevaContractor.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      seva: {
        select: {
          id: true,
          code: true,
          title: true,
          category: { select: { id: true, name: true } },
        },
      },
    },
  });

  let totalQuoted = 0;
  let totalFinal = 0;
  let totalInvoiced = 0;

  for (const l of links) {
    if (l.quotedAmount) totalQuoted += Number(l.quotedAmount);
    if (l.finalAmount) totalFinal += Number(l.finalAmount);
    if (l.invoicedAmount) totalInvoiced += Number(l.invoicedAmount);
  }

  return NextResponse.json(
    {
      data: {
        contractorId: params.id,
        dateRange: fromParam && toParam ? { from: fromParam, to: toParam } : null,
        totals: {
          jobsCount: links.length,
          totalQuoted,
          totalFinal,
          totalInvoiced,
        },
        links,
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
});
