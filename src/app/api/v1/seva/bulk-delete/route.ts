import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { bulkDeleteSevas } from "@/modules/seva/archiveService";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

const bulkDeleteSchema = z
  .object({
    sevaIds: z.array(z.string().uuid()).min(1, "At least one Seva ID is required"),
  })
  .strict();

export const POST = withAuth("seva.read", async (req, { user }) => {
  // Allow Admin or Coordinator
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR") {
    throw new AppError(403, "FORBIDDEN", "Insufficient permissions to delete Sevas");
  }

  const body = await validateBody(bulkDeleteSchema, req);
  const result = await bulkDeleteSevas({
    sevaIds: body.sevaIds,
    userId: user.id,
  });

  return NextResponse.json({
    success: true,
    deletedCount: result.deletedCount,
  });
});
