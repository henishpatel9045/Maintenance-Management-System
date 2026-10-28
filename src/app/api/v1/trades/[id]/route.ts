import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { AppError } from "@/core/http/error";
import { ensureContractorsEnabled, updateTradeSchema } from "@/modules/contractors";

export const runtime = "nodejs";

export const PATCH = withAuth<{ id: string }>("contractors.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(updateTradeSchema, req);
  const existing = await db.trade.findUnique({ where: { id: params.id } });
  if (!existing) throw new AppError(404, "NOT_FOUND", "Trade not found");

  const updated = await db.trade.update({
    where: { id: params.id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
    },
  });

  await logAudit({
    entityType: "TRADE",
    entityId: params.id,
    userId: user.id,
    action: "UPDATE_TRADE",
    oldValue: { name: existing.name },
    newValue: { name: updated.name, changes: body },
  });

  return NextResponse.json({ data: updated });
});
