import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

export const POST = withAuth("artefacts.manage", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const existing = await db.sevaFile.findUnique({ where: { id } });
  if (!existing || !existing.deletedAt) {
    throw new AppError(404, "FILE_NOT_FOUND", "Deleted file not found");
  }

  const restored = await db.sevaFile.update({
    where: { id },
    data: { deletedAt: null },
  });

  await logAudit({
    entityType: "SEVA_FILE",
    entityId: id,
    userId: user.id,
    action: "RESTORE_FILE",
  });

  return NextResponse.json({ success: true, message: "File restored successfully" });
});
