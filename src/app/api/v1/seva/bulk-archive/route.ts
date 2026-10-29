import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { bulkArchiveSevas } from "@/modules/seva/archiveService";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

const bulkArchiveSchema = z
  .object({
    sevaIds: z.array(z.string().uuid()).min(1, "At least one Seva ID is required"),
    scheduleFilePurge: z.boolean().optional().default(false),
  })
  .strict();

export const POST = withAuth("seva.read", async (req, { user }) => {
  // Allow Admin, Coordinator, or users with seva.archive permission
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR" && !user.permissions.has("seva.archive")) {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions to archive Sevas");
  }

  const body = await validateBody(bulkArchiveSchema, req);
  const result = await bulkArchiveSevas({
    sevaIds: body.sevaIds,
    userId: user.id,
    scheduleFilePurge: body.scheduleFilePurge,
  });

  return NextResponse.json({
    success: true,
    archivedCount: result.archivedCount,
    purgeScheduled: result.purgeScheduled,
    purgeAt: result.purgeAt ? result.purgeAt.toISOString() : undefined,
    fileCount: result.fileCount,
  });
});
