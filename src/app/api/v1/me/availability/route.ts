import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  AvailabilityService,
  ensureLicencesEnabled,
  userAvailabilitySchema,
} from "@/modules/licences";

export const runtime = "nodejs";

export const GET = withAuth("licences.own.view", async (req, { user }) => {
  await ensureLicencesEnabled();
  const availability = await AvailabilityService.getUserAvailability(user.id);
  return NextResponse.json(
    { data: availability },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PUT = withAuth("licences.own.submit", async (req, { user }) => {
  await ensureLicencesEnabled();
  const body = await validateBody(userAvailabilitySchema, req);
  const updated = await AvailabilityService.setUserAvailability(user.id, body, user.id);
  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
});
