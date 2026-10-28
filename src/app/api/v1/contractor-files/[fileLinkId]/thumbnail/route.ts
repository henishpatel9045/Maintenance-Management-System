import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { Readable } from "stream";
import {
  ContractorStorageService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ fileLinkId: string }>("contractors.documents.view", async (req, { params }) => {
  await ensureContractorsEnabled();

  const thumbInfo = await ContractorStorageService.streamThumbnail(params.fileLinkId);
  const readableStream = Readable.toWeb(thumbInfo.stream) as ReadableStream;

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": thumbInfo.mimeType,
      "Cache-Control": "private, max-age=86400",
    },
  });
});
