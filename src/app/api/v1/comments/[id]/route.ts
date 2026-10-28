import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const patchCommentSchema = z
  .object({
    body: z.string().min(1).max(5000),
  })
  .strict();

export const PATCH = withAuth("comments.create", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(patchCommentSchema, req);

  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  // Must be author
  if (existing.userId !== user.id && user.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "You can only edit your own comments");
  }

  // 10-minute edit window check
  const TEN_MINUTES_MS = 10 * 60 * 1000;
  const elapsed = Date.now() - new Date(existing.createdAt).getTime();
  if (elapsed > TEN_MINUTES_MS && user.role !== "ADMIN") {
    throw new AppError(400, "EDIT_WINDOW_EXPIRED", "Comments can only be edited within 10 minutes of posting");
  }

  const updated = await db.comment.update({
    where: { id },
    data: {
      body: body.body,
      editedAt: new Date(),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    entityType: "COMMENT",
    entityId: id,
    userId: user.id,
    action: "EDIT_COMMENT",
    oldValue: { body: existing.body },
    newValue: { body: updated.body },
  });

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth({}, async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const existing = await db.comment.findUnique({ where: { id } });
  if (!existing || existing.deletedAt) {
    throw new AppError(404, "COMMENT_NOT_FOUND", "Comment not found");
  }

  // Author or Admin can delete
  if (existing.userId !== user.id && user.role !== "ADMIN") {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to delete this comment");
  }

  await db.comment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logAudit({
    entityType: "COMMENT",
    entityId: id,
    userId: user.id,
    action: "DELETE_COMMENT",
  });

  return NextResponse.json({ success: true, message: "Comment deleted" });
});
