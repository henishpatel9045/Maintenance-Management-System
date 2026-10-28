import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const categorySchema = z
  .object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#4f46e5"),
    icon: z.string().max(50).optional().nullable(),
  })
  .strict();

export const GET = withAuth({}, async () => {
  const categories = await db.category.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: categories });
});

export const POST = withAuth("masters.manage", async (req, { user }) => {
  const body = await validateBody(categorySchema, req);

  const existing = await db.category.findUnique({ where: { name: body.name } });
  if (existing) {
    throw new AppError(409, "CATEGORY_EXISTS", "A category with this name already exists");
  }

  const category = await db.category.create({
    data: {
      name: body.name,
      description: body.description ?? null,
      color: body.color,
      icon: body.icon ?? null,
    },
  });

  await logAudit({
    entityType: "CATEGORY",
    entityId: category.id,
    userId: user.id,
    action: "CREATE_CATEGORY",
    newValue: category,
  });

  return NextResponse.json({ data: category }, { status: 201 });
});
