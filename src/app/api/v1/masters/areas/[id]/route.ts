import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const updateAreaSchema = z
  .object({
    name: z.string().trim().min(1, "Name cannot be empty").max(150).optional(),
    parentId: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .or(z.literal(""))
      .transform((v) => (!v ? null : v)),
    sortOrder: z.coerce.number().int().optional(),
  })
  .strict();

async function isDescendant(targetId: string, possibleAncestorId: string): Promise<boolean> {
  let currentId: string | null = targetId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) break;
    visited.add(currentId);

    if (currentId === possibleAncestorId) {
      return true;
    }

    const current: { parentId: string | null } | null = await db.area.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = current?.parentId ?? null;
  }

  return false;
}

export const GET = withAuth({}, async (_req, { params }) => {
  const { id } = params as { id: string };

  const area = await db.area.findUnique({
    where: { id },
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

  if (!area) {
    throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
  }

  return NextResponse.json({ data: area });
});

export const PATCH = withAuth("masters.manage", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(updateAreaSchema, req);

  const existing = await db.area.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, name: true } },
    },
  });

  if (!existing) {
    throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
  }

  if (body.parentId) {
    if (body.parentId === id) {
      throw new AppError(400, "INVALID_PARENT", "An area cannot be its own parent");
    }

    const parent = await db.area.findUnique({ where: { id: body.parentId } });
    if (!parent) {
      throw new AppError(404, "PARENT_NOT_FOUND", "Selected parent area does not exist");
    }

    const createsCycle = await isDescendant(body.parentId, id);
    if (createsCycle) {
      throw new AppError(400, "INVALID_PARENT", "Cannot set parent to an area that is currently a descendant");
    }
  }

  const updated = await db.area.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.parentId !== undefined ? { parentId: body.parentId } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
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
    entityId: id,
    userId: user.id,
    action: "UPDATE_AREA",
    oldValue: existing,
    newValue: updated,
  });

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth("masters.manage", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const existing = await db.area.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          children: true,
          sevas: true,
          sevaRequests: true,
        },
      },
    },
  });

  if (!existing) {
    throw new AppError(404, "AREA_NOT_FOUND", "Area not found");
  }

  if (existing._count.children > 0) {
    throw new AppError(
      400,
      "AREA_HAS_CHILDREN",
      `Cannot delete "${existing.name}" because it contains ${existing._count.children} sub-area(s). Reassign or delete sub-areas first.`
    );
  }

  if (existing._count.sevas > 0) {
    throw new AppError(
      400,
      "AREA_IN_USE",
      `Cannot delete "${existing.name}" because it is referenced by ${existing._count.sevas} Seva task(s). Reassign them to another area first.`
    );
  }

  if (existing._count.sevaRequests > 0) {
    throw new AppError(
      400,
      "AREA_IN_USE",
      `Cannot delete "${existing.name}" because it is referenced by ${existing._count.sevaRequests} Seva request(s). Reassign or resolve them first.`
    );
  }

  await db.area.delete({ where: { id } });

  await logAudit({
    entityType: "AREA",
    entityId: id,
    userId: user.id,
    action: "DELETE_AREA",
    oldValue: existing,
  });

  return NextResponse.json({
    success: true,
    message: `Area "${existing.name}" was successfully removed`,
  });
});
