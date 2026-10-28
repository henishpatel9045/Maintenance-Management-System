import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { verifyPassword, hashPassword, validatePasswordStrength } from "@/core/auth/hash";
import { revokeAllUserSessions, createSession, SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/core/auth/session";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(10, "Password must be at least 10 characters long"),
  })
  .strict();

export const POST = withAuth({}, async (req, { user }) => {
  const body = await validateBody(changePasswordSchema, req);

  // 1. Password complexity & blacklist check
  const strengthCheck = validatePasswordStrength(body.newPassword);
  if (!strengthCheck.valid) {
    throw new AppError(400, "WEAK_PASSWORD", strengthCheck.message || "Password does not meet complexity requirements");
  }

  // 2. Fetch current password hash & verify
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  if (!dbUser) {
    throw new AppError(404, "USER_NOT_FOUND", "User not found");
  }

  const isValidCurrent = await verifyPassword(dbUser.passwordHash, body.currentPassword);
  if (!isValidCurrent) {
    throw new AppError(400, "INVALID_CURRENT_PASSWORD", "The current password provided is incorrect");
  }

  // 3. Hash new password & update
  const newHash = await hashPassword(body.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      mustChangePassword: false,
    },
  });

  // 4. Invalidate all previous sessions (defense against session hijacking)
  await revokeAllUserSessions(user.id);

  // 5. Issue new session for current device
  const { token, expiresAt } = await createSession({
    userId: user.id,
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1",
  });

  await logAudit({
    entityType: "AUTH",
    entityId: user.id,
    userId: user.id,
    action: "PASSWORD_CHANGED",
  });

  const response = NextResponse.json({ success: true, message: "Password changed successfully" });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
  return response;
});
