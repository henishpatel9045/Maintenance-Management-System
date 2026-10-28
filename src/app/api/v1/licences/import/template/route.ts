import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  LicenceImportService,
  ensureLicencesEnabled,
} from "@/modules/licences";

export const runtime = "nodejs";

// GET /api/v1/licences/import/template - licences.import
export const GET = withAuth("licences.import", async () => {
  await ensureLicencesEnabled();

  const csvContent = LicenceImportService.getCsvTemplate();

  const headers = new Headers();
  headers.set("Content-Type", "text/csv; charset=utf-8");
  headers.set("Content-Disposition", 'attachment; filename="licences_import_template.csv"');
  headers.set("Cache-Control", "no-store");

  return new NextResponse(csvContent, {
    status: 200,
    headers,
  });
});
