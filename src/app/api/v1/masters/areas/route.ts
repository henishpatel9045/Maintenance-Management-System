import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const areaSchema = z
  .object({
    name: z.string().trim().min(1, "Area name is required").max(150),
    parentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((v) => (!v ? null : v)),
    sortOrder: z.coerce.number().int().default(0),
  })
  .strict();

export const GET = withAuth({}, async () => {
  const areas = await db.area.findMany({
    include: {
      parent: { select: { id: true, name: true } },
      _count: {
        select: {
          children: true,
          sevas: true,
          sevaRequests: true,
        },
      },
    },
    orderBy: [{ parentId: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ data: areas });
});

export const POST = withAuth("masters.manage", async (req, { user }) => {
  const body = await validateBody(areaSchema, req);

  if (body.parentId) {
    const parent = await db.area.findUnique({ where: { id: body.parentId } });
    if (!parent) {
      throw new AppError(404, "PARENT_NOT_FOUND", "Parent area not found");
    }
  }

  const area = await db.area.create({
    data: {
      name: body.name,
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder,
    },
    include: {
      parent: { select: { id: true, name: true } },
      _count: {
        select: {
          children: true,
          sevas: true,
          sevaRequests: true,
        },
      },
    },
  });

  await logAudit({
    entityType: "AREA",
    entityId: area.id,
    userId: user.id,
    action: "CREATE_AREA",
    newValue: area,
  });

  return NextResponse.json({ data: area }, { status: 201 });
});
