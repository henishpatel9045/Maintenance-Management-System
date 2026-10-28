import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, revokeSession, validateSession } from "@/core/auth/session";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    const sessionData = await validateSession(token);
    await revokeSession(token);
    await logAudit({
      entityType: "AUTH",
      entityId: sessionData?.user.id ?? "session",
      userId: sessionData?.user.id ?? null,
      action: "LOGOUT",
    });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.delete(SESSION_COOKIE_NAME);
  return response;
}

