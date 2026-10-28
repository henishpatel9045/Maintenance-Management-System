import crypto from "crypto";
import { db } from "../db";
import { config } from "../config";
import { logger } from "../logger";

export const SESSION_COOKIE_NAME = "seva_session";
const IDLE_TIMEOUT_MS = 12 * 60 * 60 * 1000; // 12 hours
const ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function createSession(params: {
  userId: string;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const tokenHash = hashToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ABSOLUTE_TIMEOUT_MS);

  await db.session.create({
    data: {
      userId: params.userId,
      tokenHash,
      userAgent: params.userAgent?.slice(0, 500) ?? null,
      ip: params.ip?.slice(0, 100) ?? null,
      expiresAt,
      lastSeenAt: now,
    },
  });

  return { token, expiresAt };
}

export async function validateSession(token: string): Promise<{
  session: { id: string; userId: string };
  user: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    role: string;
    isActive: boolean;
    mustChangePassword: boolean;
    permissions: Set<string>;
    settings: Record<string, unknown>;
  };
} | null> {
  if (!token || typeof token !== "string") {
    return null;
  }

  const tokenHash = hashToken(token);
  const session = await db.session.findUnique({
    where: { tokenHash },
    include: {
      user: {
        include: {
          role: {
            include: {
              permissions: true,
            },
          },
          permissionOverrides: true,
        },
      },
    },
  });

  if (!session || !session.user || !session.user.isActive) {
    return null;
  }

  const now = new Date();

  // Check absolute timeout
  if (now > session.expiresAt) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Check idle timeout
  const idleExpiration = new Date(session.lastSeenAt.getTime() + IDLE_TIMEOUT_MS);
  if (now > idleExpiration) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  // Slide lastSeenAt if more than 5 minutes since last update
  if (now.getTime() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.session
      .update({
        where: { id: session.id },
        data: { lastSeenAt: now },
      })
      .catch((err) => {
        logger.warn({ err }, "Failed to update session lastSeenAt");
      });
  }

  // Build permissions set
  const permissions = new Set<string>();
  for (const p of session.user.role.permissions) {
    permissions.add(p.permissionKey);
  }
  for (const o of session.user.permissionOverrides) {
    if (o.granted) {
      permissions.add(o.permissionKey);
    } else {
      permissions.delete(o.permissionKey);
    }
  }

  // Coordinators have masters.manage and seva.assign for task assignment
  if (session.user.role.name === "COORDINATOR") {
    permissions.add("masters.manage");
    permissions.add("seva.assign");
  }

  // Load settings map
  const dbSettings = await db.setting.findMany();
  const settings: Record<string, unknown> = {};
  for (const s of dbSettings) {
    settings[s.key] = s.value;
  }

  return {
    session: { id: session.id, userId: session.userId },
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      phone: session.user.phone,
      role: session.user.role.name,
      isActive: session.user.isActive,
      mustChangePassword: session.user.mustChangePassword,
      permissions,
      settings,
    },
  };
}

export async function revokeSession(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await db.session.deleteMany({ where: { tokenHash } });
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}

export function getSessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
