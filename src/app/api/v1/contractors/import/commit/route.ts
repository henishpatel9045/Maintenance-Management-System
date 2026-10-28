import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { AppError } from "@/core/http/error";
import {
  ImportService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth("contractors.import", async (req, { user }) => {
  await ensureContractorsEnabled();

  const contentType = req.headers.get("content-type") || "";
  let csvContent = "";
  let updateMatched = false;

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new AppError(400, "MISSING_FILE", "CSV file is required");
    csvContent = await file.text();
    updateMatched = formData.get("updateMatchedRecords") === "true";
  } else {
    const json = await req.json();
    csvContent = json.csvContent;
    updateMatched = Boolean(json.updateMatchedRecords);
  }

  if (!csvContent) {
    throw new AppError(400, "EMPTY_PAYLOAD", "CSV content is required");
  }

  const result = await ImportService.commit(csvContent, updateMatched, user.id);

  return NextResponse.json({ success: true, data: result });
});
