import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  LicenceImportService,
  ensureLicencesEnabled,
} from "@/modules/licences";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

// POST /api/v1/licences/import/preview - licences.import
export const POST = withAuth("licences.import", async (req, { user }) => {
  await ensureLicencesEnabled();

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) throw new AppError(400, "MISSING_FILE", "CSV file is required");

  const text = await file.text();
  const preview = await LicenceImportService.previewCsv(text, user.settings);

  return NextResponse.json(
    { data: preview },
    { headers: { "Cache-Control": "no-store" } }
  );
});
