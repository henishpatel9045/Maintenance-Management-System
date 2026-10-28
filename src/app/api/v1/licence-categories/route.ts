import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { LicenceTypeService, ensureLicencesEnabled, licenceCategorySchema } from "@/modules/licences";

export const runtime = "nodejs";

export const GET = withAuth({}, async () => {
  await ensureLicencesEnabled();
  const categories = await LicenceTypeService.getCategories();
  return NextResponse.json(
    { data: categories },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withAuth("licences.types.manage", async (req, { user }) => {
  await ensureLicencesEnabled();
  const body = await validateBody(licenceCategorySchema, req);
  const created = await LicenceTypeService.createCategory(body, user.id);
  return NextResponse.json(
    { data: created },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
});
