import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";

export const runtime = "nodejs";

export const POST = withAuth({}, async (_req, { user }) => {
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true, message: "All notifications marked as read" });
});
