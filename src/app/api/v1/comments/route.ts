import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const createCommentSchema = z
  .object({
    entityType: z.string().default("SEVA"),
    entityId: z.string().uuid(),
    occurrenceId: z.string().uuid().optional().nullable(),
    body: z.string().min(1).max(5000),
  })
  .strict();

export const GET = withAuth("seva.read", async (req) => {
  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") || "SEVA";
  const entityId = url.searchParams.get("entityId");

  if (!entityId) {
    throw new AppError(400, "MISSING_ENTITY_ID", "entityId query parameter is required");
  }

  const comments = await db.comment.findMany({
    where: {
      entityType,
      entityId,
      deletedAt: null,
    },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: comments });
});

export const POST = withAuth("comments.create", async (req, { user }) => {
  const body = await validateBody(createCommentSchema, req);

  const comment = await db.comment.create({
    data: {
      entityType: body.entityType ?? "SEVA",
      entityId: body.entityId,
      occurrenceId: body.occurrenceId ?? null,
      userId: user.id,
      body: body.body,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  await logAudit({
    entityType: "COMMENT",
    entityId: comment.id,
    userId: user.id,
    action: "CREATE_COMMENT",
    newValue: { entityType: body.entityType, entityId: body.entityId },
  });

  // Extract @mentions and notify mentioned users
  // Regex matches @Name Name or @username
  const mentionMatches = body.body.match(/@([a-zA-Z0-9_\s]{2,30})/g);
  if (mentionMatches && mentionMatches.length > 0) {
    const rawNames = mentionMatches.map((m) => m.slice(1).trim());
    const mentionedUsers = await db.user.findMany({
      where: {
        OR: [
          ...rawNames.map((n) => ({ name: { contains: n, mode: "insensitive" as const } })),
          ...rawNames.map((n) => ({ email: { contains: n, mode: "insensitive" as const } })),
        ],
        id: { not: user.id },
      },
      select: { id: true },
    });

    if (mentionedUsers.length > 0) {
      await db.notification.createMany({
        data: mentionedUsers.map((mu) => ({
          userId: mu.id,
          type: "MENTIONED_IN_COMMENT",
          title: `Mentioned by ${user.name}`,
          body: body.body.slice(0, 200),
          entityType: body.entityType,
          entityId: body.entityId,
          linkUrl: `/seva/${body.entityId}`,
        })),
      });
    }
  }

  return NextResponse.json({ data: comment }, { status: 201 });
});
