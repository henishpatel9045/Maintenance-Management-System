import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

const setCategoryTradesSchema = z.object({
  categoryId: z.string().uuid(),
  tradeIds: z.array(z.string().uuid()),
}).strict();

export const GET = withAuth("contractors.read", async (req) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const categoryId = url.searchParams.get("categoryId") || undefined;

  const mappings = await db.categoryTrade.findMany({
    where: categoryId ? { categoryId } : undefined,
    include: {
      category: { select: { id: true, name: true } },
      trade: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ data: mappings });
});

export const PUT = withAuth("contractors.manage", async (req, { user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(setCategoryTradesSchema, req);

  await db.$transaction(async (tx) => {
    await tx.categoryTrade.deleteMany({
      where: { categoryId: body.categoryId },
    });

    if (body.tradeIds.length > 0) {
      await tx.categoryTrade.createMany({
        data: body.tradeIds.map((tradeId) => ({
          categoryId: body.categoryId,
          tradeId,
        })),
      });
    }
  });

  await logAudit({
    entityType: "CATEGORY_TRADE",
    entityId: body.categoryId,
    userId: user.id,
    action: "UPDATE_CATEGORY_TRADES",
    newValue: { tradeIds: body.tradeIds },
  });

  return NextResponse.json({ success: true });
});
