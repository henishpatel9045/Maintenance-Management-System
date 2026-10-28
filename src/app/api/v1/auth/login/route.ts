import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/core/db";
import { verifyPassword } from "@/core/auth/hash";
import { createSession, SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/core/auth/session";
import { isLoginThrottled, recordLoginAttempt } from "@/core/auth/throttle";
import { errorResponse, AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { validateBody } from "@/core/http/validate";
import { logger } from "@/core/logger";

export const runtime = "nodejs";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
}).strict();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const userAgent = req.headers.get("user-agent") || null;

  try {
    const body = await validateBody(loginSchema, req);
    const email = body.email.toLowerCase().trim();

    // 1. Check Rate Limiter / Lockout
    const throttle = isLoginThrottled({ ip, email });
    if (throttle.throttled) {
      logger.warn({ ip, email, retryAfter: throttle.retryAfterSeconds }, "Login throttled");
      await logAudit({
        entityType: "AUTH",
        entityId: email,
        action: "LOGIN_THROTTLED",
        newValue: { ip, retryAfter: throttle.retryAfterSeconds },
      });
      return errorResponse(
        429,
        "TOO_MANY_ATTEMPTS",
        `Too many login attempts. Please try again in ${throttle.retryAfterSeconds} seconds.`
      );
    }

    // 2. Fetch User & Verify Password
    const user = await db.user.findUnique({
      where: { email },
      include: {
        role: {
          include: { permissions: true },
        },
        permissionOverrides: true,
      },
    });

    let isValid = false;
    if (user && user.isActive) {
      isValid = await verifyPassword(user.passwordHash, body.password);
    } else {
      // Timing attack countermeasure: perform dummy hash verification
      await verifyPassword(
        "$argon2id$v=19$m=65536,t=3,p=1$dummySaltForTimingEquivalence$dummyHashOutputValuePadding1234567890",
        body.password
      );
    }

    if (!isValid || !user || !user.isActive) {
      recordLoginAttempt({ ip, email, success: false });
      await logAudit({
        entityType: "AUTH",
        entityId: email,
        action: "LOGIN_FAILED",
        newValue: { ip, reason: !user ? "UNKNOWN_USER" : !user.isActive ? "INACTIVE" : "WRONG_PASSWORD" },
      });
      // Identical error message for unknown user vs wrong password
      return errorResponse(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    // 3. Successful login
    recordLoginAttempt({ ip, email, success: true });

    // Update lastLoginAt
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Create session
    const { token, expiresAt } = await createSession({
      userId: user.id,
      userAgent,
      ip,
    });

    await logAudit({
      entityType: "AUTH",
      entityId: user.id,
      userId: user.id,
      action: "LOGIN_SUCCESS",
      newValue: { ip, userAgent },
    });

    // Build permissions list
    const permissions = new Set<string>();
    for (const p of user.role.permissions) {
      permissions.add(p.permissionKey);
    }
    for (const o of user.permissionOverrides) {
      if (o.granted) permissions.add(o.permissionKey);
      else permissions.delete(o.permissionKey);
    }

    const response = NextResponse.json({
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role.name,
          mustChangePassword: user.mustChangePassword,
          permissions: Array.from(permissions),
        },
      },
    });

    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions(expiresAt));
    return response;
  } catch (err) {
    if (err instanceof AppError) {
      return errorResponse(err.statusCode, err.code, err.message, err.details);
    }
    logger.error({ err }, "Login endpoint error");
    return errorResponse(500, "INTERNAL_ERROR", "Login failed due to an unexpected error");
  }
}
