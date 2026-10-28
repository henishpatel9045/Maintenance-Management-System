import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const POST = withAuth("seva.archive", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const seva = await db.seva.findUnique({ where: { id } });
  if (!seva) throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");

  await db.seva.update({
    where: { id },
    data: { isArchived: false },
  });

  await logAudit({
    entityType: "SEVA",
    entityId: id,
    userId: user.id,
    action: "UNARCHIVE_SEVA",
  });

  return NextResponse.json({ success: true, message: "Seva unarchived successfully" });
});
