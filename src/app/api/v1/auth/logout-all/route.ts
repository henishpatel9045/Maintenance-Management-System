import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { revokeAllUserSessions, SESSION_COOKIE_NAME } from "@/core/auth/session";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

export const POST = withAuth({}, async (_req, { user }) => {
  await revokeAllUserSessions(user.id);
  await logAudit({
    entityType: "AUTH",
    entityId: user.id,
    userId: user.id,
    action: "LOGOUT_ALL_DEVICES",
  });

  const response = NextResponse.json({ success: true, message: "Logged out from all devices" });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
});
