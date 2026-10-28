import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const tagSchema = z
  .object({
    name: z.string().min(1).max(50),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#64748b"),
  })
  .strict();

export const GET = withAuth({}, async () => {
  const tags = await db.tag.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: tags });
});

export const POST = withAuth("masters.manage", async (req, { user }) => {
  const body = await validateBody(tagSchema, req);

  const existing = await db.tag.findUnique({ where: { name: body.name } });
  if (existing) {
    return NextResponse.json({ data: existing });
  }

  const tag = await db.tag.create({
    data: {
      name: body.name,
      color: body.color,
    },
  });

  await logAudit({
    entityType: "TAG",
    entityId: tag.id,
    userId: user.id,
    action: "CREATE_TAG",
    newValue: tag,
  });

  return NextResponse.json({ data: tag }, { status: 201 });
});
