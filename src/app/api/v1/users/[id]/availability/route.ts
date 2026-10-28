import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  AvailabilityService,
  ensureLicencesEnabled,
  userAvailabilitySchema,
} from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const PUT = withAuth<{ id: string }>("licences.manage", async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const targetUserId = params.id;
  if (!targetUserId) throw new AppError(400, "INVALID_ID", "User ID is required");

  const body = await validateBody(userAvailabilitySchema, req);
  const updated = await AvailabilityService.setUserAvailability(targetUserId, body, user.id);

  return NextResponse.json(
    { data: updated },
    { headers: { "Cache-Control": "no-store" } }
  );
});
