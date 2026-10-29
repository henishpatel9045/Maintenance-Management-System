import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody, validateQuery } from "@/core/http/validate";
import { db } from "@/core/db";
import { hashPassword, validatePasswordStrength } from "@/core/auth/hash";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { can } from "@/core/permissions/can";

export const runtime = "nodejs";

const createUserSchema = z
  .object({
    name: z.string().min(1).max(255),
    email: z.string().email(),
    phone: z.string().optional().nullable(),
    roleId: z.string().uuid(),
    password: z.string().min(10),
  })
  .strict();

export const GET = withAuth({}, async (_req, { user }) => {
  const isAdminOrUserMgr = user.role === "ADMIN" || user.role === "COORDINATOR" || can(user, "users.manage");

  const users = await db.user.findMany({
    where: isAdminOrUserMgr ? {} : { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      phone: isAdminOrUserMgr,
      isActive: true,
      mustChangePassword: isAdminOrUserMgr,
      lastLoginAt: isAdminOrUserMgr,
      createdAt: isAdminOrUserMgr,
      role: {
        select: { id: true, name: true, description: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ data: users });
});

export const POST = withAuth({}, async (req, { user }) => {
  if (user.role !== "ADMIN" && user.role !== "COORDINATOR" && !can(user, "users.manage")) {
    throw new AppError(403, "FORBIDDEN", "Forbidden");
  }
  const body = await validateBody(createUserSchema, req);
  const email = body.email.toLowerCase().trim();

  // Check unique email
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError(409, "EMAIL_EXISTS", "A user with this email address already exists");
  }

  // Validate password
  const strength = validatePasswordStrength(body.password);
  if (!strength.valid) {
    throw new AppError(400, "WEAK_PASSWORD", strength.message || "Password is weak");
  }

  const role = await db.role.findUnique({ where: { id: body.roleId } });
  if (!role) {
    throw new AppError(404, "ROLE_NOT_FOUND", "Specified role not found");
  }

  const passwordHash = await hashPassword(body.password);

  const newUser = await db.user.create({
    data: {
      name: body.name,
      email,
      phone: body.phone ?? null,
      roleId: body.roleId,
      passwordHash,
      isActive: true,
      mustChangePassword: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: { select: { id: true, name: true } },
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
    },
  });

  await logAudit({
    entityType: "USER",
    entityId: newUser.id,
    userId: user.id,
    action: "CREATE_USER",
    newValue: { email: newUser.email, role: newUser.role.name },
  });

  return NextResponse.json({ data: newUser }, { status: 201 });
});
