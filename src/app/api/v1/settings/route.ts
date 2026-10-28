import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";

export const runtime = "nodejs";

const patchSettingsSchema = z.record(z.unknown());

export const GET = withAuth({}, async () => {
  const dbSettings = await db.setting.findMany();
  const settings: Record<string, unknown> = {};
  for (const s of dbSettings) {
    settings[s.key] = s.value;
  }
  return NextResponse.json({ data: settings });
});

export const PATCH = withAuth("settings.manage", async (req, { user }) => {
  const body = await validateBody(patchSettingsSchema, req);

  for (const [key, value] of Object.entries(body)) {
    await db.setting.upsert({
      where: { key },
      update: { value: value as any },
      create: { key, value: value as any },
    });
  }

  await logAudit({
    entityType: "SETTINGS",
    entityId: "system",
    userId: user.id,
    action: "UPDATE_SETTINGS",
    newValue: body,
  });

  return NextResponse.json({ success: true, updatedKeys: Object.keys(body) });
});
