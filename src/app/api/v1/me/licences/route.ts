import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  LicenceService,
  ensureLicencesEnabled,
  selfSubmitLicenceSchema,
} from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/me/licences - See my own licences (licences.own.view)
export const GET = withAuth("licences.own.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const licences = await LicenceService.getOwnLicences(user.id);

  return NextResponse.json(
    { data: licences },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// POST /api/v1/me/licences - Submit licence for verification (licences.own.submit)
export const POST = withAuth("licences.own.submit", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(selfSubmitLicenceSchema, req);
  const created = await LicenceService.submitOwnLicence(user.id, body, user.settings);

  return NextResponse.json(
    { data: created },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
});
