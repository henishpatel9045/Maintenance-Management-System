import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
    icon: z.string().max(50).optional().nullable(),
  })
  .strict();

export const PATCH = withAuth("masters.manage", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(updateCategorySchema, req);

  const existing = await db.category.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "CATEGORY_NOT_FOUND", "Category not found");
  }

  const updated = await db.category.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.color ? { color: body.color } : {}),
      ...(body.icon !== undefined ? { icon: body.icon } : {}),
    },
  });

  await logAudit({
    entityType: "CATEGORY",
    entityId: id,
    userId: user.id,
    action: "UPDATE_CATEGORY",
    oldValue: existing,
    newValue: updated,
  });

  return NextResponse.json({ data: updated });
});
