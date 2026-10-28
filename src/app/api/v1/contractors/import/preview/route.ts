import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { AppError } from "@/core/http/error";
import {
  ImportService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth("contractors.import", async (req) => {
  await ensureContractorsEnabled();

  const contentType = req.headers.get("content-type") || "";
  let csvContent = "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new AppError(400, "MISSING_FILE", "CSV file is required");
    csvContent = await file.text();
  } else {
    csvContent = await req.text();
  }

  const preview = await ImportService.preview(csvContent);

  return NextResponse.json({ data: preview });
});
