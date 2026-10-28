import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { Readable } from "stream";
import {
  ContractorStorageService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ fileLinkId: string }>("contractors.documents.view", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const fileInfo = await ContractorStorageService.streamFile(params.fileLinkId, user);

  const readableStream = Readable.toWeb(fileInfo.stream) as ReadableStream;

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": fileInfo.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(fileInfo.filename)}"`,
      "Content-Length": String(fileInfo.sizeBytes),
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
});
