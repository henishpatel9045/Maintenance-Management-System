import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";

export const runtime = "nodejs";

export const POST = withAuth("seva.read", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  const existing = await db.sevaWatcher.findUnique({
    where: { sevaId_userId: { sevaId: id, userId: user.id } },
  });

  if (existing) {
    await db.sevaWatcher.delete({
      where: { sevaId_userId: { sevaId: id, userId: user.id } },
    });
    return NextResponse.json({ watching: false });
  }

  await db.sevaWatcher.create({
    data: { sevaId: id, userId: user.id },
  });

  return NextResponse.json({ watching: true });
});
