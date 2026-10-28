import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { Readable } from "stream";
import {
  ContractorStorageService,
  ensureContractorsEnabled,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.documents.view", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const zipInfo = await ContractorStorageService.createContractorZipStream(params.id, user);
  const readableStream = Readable.toWeb(zipInfo.stream) as ReadableStream;

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(zipInfo.filename)}"`,
      "Cache-Control": "no-store",
    },
  });
});
