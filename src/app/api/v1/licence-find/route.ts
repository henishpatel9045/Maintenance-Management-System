import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  VolunteerService,
  ensureLicencesEnabled,
  findVolunteersSchema,
  getLicenceTierContext,
} from "@/modules/licences";

export const runtime = "nodejs";

// POST /api/v1/licence-find - licences.directory.view
export const POST = withAuth("licences.directory.view", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(findVolunteersSchema, req);
  const tierContext = getLicenceTierContext(user);

  const result = await VolunteerService.findVolunteers(body, tierContext);

  return NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "no-store" } }
  );
});
