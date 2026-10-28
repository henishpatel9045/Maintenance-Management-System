import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  LicenceImportService,
  ensureLicencesEnabled,
  licenceImportCommitSchema,
} from "@/modules/licences";

export const runtime = "nodejs";

// POST /api/v1/licences/import/commit - licences.import
export const POST = withAuth("licences.import", async (req, { user }) => {
  await ensureLicencesEnabled();

  const body = await validateBody(licenceImportCommitSchema, req);
  const result = await LicenceImportService.commitImport(body.rows, user.id);

  return NextResponse.json(
    { data: result },
    { headers: { "Cache-Control": "no-store" } }
  );
});
