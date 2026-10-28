import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { ensureContractorsEnabled, createTradeSchema } from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth("contractors.read", async () => {
  await ensureContractorsEnabled();

  const trades = await db.trade.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: trades });
});

export const POST = withAuth("contractors.manage", async (req, { user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(createTradeSchema, req);
  const trade = await db.trade.create({
    data: {
      name: body.name,
      description: body.description || null,
      isActive: body.isActive ?? true,
      sortOrder: body.sortOrder ?? 0,
    },
  });

  await logAudit({
    entityType: "TRADE",
    entityId: trade.id,
    userId: user.id,
    action: "CREATE_TRADE",
    newValue: { name: trade.name },
  });

  return NextResponse.json({ data: trade }, { status: 201 });
});
