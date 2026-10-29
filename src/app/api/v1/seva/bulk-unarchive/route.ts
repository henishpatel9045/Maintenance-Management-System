import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { bulkUnarchiveSevas } from "@/modules/seva/archiveService";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

const bulkUnarchiveSchema = z
  .object({
    sevaIds: z.array(z.string().uuid()).min(1, "At least one Seva ID is required"),
  })
  .strict();

export const POST = withAuth("seva.read", async (req, { user }) => {
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR" && !user.permissions.has("seva.archive")) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions to unarchive Sevas");
  }

  const body = await validateBody(bulkUnarchiveSchema, req);
  const result = await bulkUnarchiveSevas({
    sevaIds: body.sevaIds,
    userId: user.id,
  });

  return NextResponse.json({
    success: true,
    unarchivedCount: result.unarchivedCount,
  });
});
