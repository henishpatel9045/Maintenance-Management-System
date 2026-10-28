import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const PATCH = withAuth({}, async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif || notif.userId !== user.id) {
    throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  }

  await db.notification.update({
    where: { id },
    data: { readAt: new Date() },
  });

  return NextResponse.json({ success: true });
});
