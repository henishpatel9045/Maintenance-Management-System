import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceTypeService, ensureLicencesEnabled, licenceTypeSchema } from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/licence-types - Accessible by anyone with a licence capability
export const GET = withAuth({}, async (req, { user }) => {
  await ensureLicencesEnabled();

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("activeOnly") !== "false";
  const categoryId = url.searchParams.get("categoryId") || undefined;

  const types = await LicenceTypeService.getTypes({ activeOnly, categoryId });

  return NextResponse.json(
    { data: types },
    { headers: { "Cache-Control": "no-store" } }
  );
});

// POST /api/v1/licence-types - licences.types.manage
export const POST = withAuth("licences.types.manage", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(licenceTypeSchema, req);
  const created = await LicenceTypeService.createType(body, user.id);

  return NextResponse.json(
    { data: created },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
});
