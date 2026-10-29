import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { revokeAllUserSessions } from "@/core/auth/session";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

const updateUserSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    email: z.string().email().optional(),
    phone: z.string().nullable().optional(),
    roleId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const GET = withAuth({}, async (_req, { user: currentUser, params }) => {
  if (currentUser.role !== "ADMIN" && currentUser.role !== "COORDINATOR" && !can(currentUser, "users.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }

  const { id } = params as { id: string };
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      roleId: true,
      isActive: true,
      mustChangePassword: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true, description: true } },
    },
  });

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  return NextResponse.json({ data: user });
});

export const PATCH = withAuth({}, async (req, { user: currentUser, params }) => {
  if (currentUser.role !== "ADMIN" && currentUser.role !== "COORDINATOR" && !can(currentUser, "users.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }

  const { id } = params as { id: string };
  const body = await validateBody(updateUserSchema, req);

  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  // If email is changed, check for conflict
  if (body.email && (!existing.email || body.email.toLowerCase().trim() !== existing.email.toLowerCase().trim())) {
    const normalizedEmail = body.email.toLowerCase().trim();
    const emailConflict = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (emailConflict && emailConflict.id !== id) {
      throw new AppError(409, "EMAIL_EXISTS", "A user with this email address already exists");
    }
  }

  if (body.roleId) {
    const role = await db.role.findUnique({ where: { id: body.roleId } });
    if (!role) {
      throw new AppError(404, "ROLE_NOT_FOUND", "Specified role not found");
    }
  }

  let openAssignments: Array<{ sevaId: string; title: string; code: string }> = [];

  // If deactivating user:
  if (body.isActive === false && existing.isActive === true) {
    // 1. Invalidate all active sessions immediately
    await revokeAllUserSessions(id);

    // 2. Fetch open assignments for admin reporting
    const assignments = await db.sevaAssignee.findMany({
      where: {
        userId: id,
        seva: { isArchived: false },
      },
      include: {
        seva: { select: { id: true, title: true, code: true } },
      },
    });
    openAssignments = assignments.map((a) => ({
      sevaId: a.seva.id,
      title: a.seva.title,
      code: a.seva.code,
    }));
  }

  const updated = await db.user.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.email ? { email: body.email.toLowerCase().trim() } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.roleId ? { roleId: body.roleId } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: { select: { id: true, name: true } },
      isActive: true,
      mustChangePassword: true,
      updatedAt: true,
    },
  });

  await logAudit({
    entityType: "USER",
    entityId: id,
    userId: currentUser.id,
    action: "UPDATE_USER",
    oldValue: {
      name: existing.name,
      email: existing.email,
      phone: existing.phone,
      isActive: existing.isActive,
      roleId: existing.roleId,
    },
    newValue: {
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      isActive: updated.isActive,
      roleId: updated.role.id,
    },
  });

  return NextResponse.json({
    data: {
      user: updated,
      openAssignments: openAssignments.length > 0 ? openAssignments : undefined,
    },
  });
});
