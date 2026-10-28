import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { hashPassword, validatePasswordStrength } from "@/core/auth/hash";
import { revokeAllUserSessions } from "@/core/auth/session";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const resetPasswordSchema = z
  .object({
    temporaryPassword: z.string().min(10, "Temporary password must be at least 10 characters long"),
    mustChangePassword: z.boolean().optional().default(true),
  })
  .strict();

export const POST = withAuth("users.manage", async (req, { user: currentUser, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(resetPasswordSchema, req);

  const targetUser = await db.user.findUnique({ where: { id } });
  if (!targetUser) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const strength = validatePasswordStrength(body.temporaryPassword);
  if (!strength.valid) {
    throw new AppError(400, "WEAK_PASSWORD", strength.message || "Temporary password is weak");
  }

  const passwordHash = await hashPassword(body.temporaryPassword);

  await db.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: body.mustChangePassword ?? true,
    },
  });

  // Invalidate all existing sessions
  await revokeAllUserSessions(id);

  await logAudit({
    entityType: "USER",
    entityId: id,
    userId: currentUser.id,
    action: "RESET_PASSWORD_ADMIN",
  });

  return NextResponse.json({ success: true, message: "Password reset successfully; user must change it upon next login" });
});
