import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { createMultiSevaZipStream } from "@/core/storage/zip";
import { Readable } from "stream";
import { AppError } from "@/core/http/error";

export const runtime = "nodejs";

export const GET = withAuth("files.download", async (req, { user }) => {
  const url = new URL(req.url);
  const idsParam = url.searchParams.get("ids");
  if (!idsParam) {
    throw new AppError(400, "MISSING_IDS", "Query parameter 'ids' is required (comma-separated)");
  }

  const sevaIds = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (sevaIds.length === 0) {
    throw new AppError(400, "INVALID_IDS", "No valid Seva IDs provided");
  }

  const { stream, filename, count } = await createMultiSevaZipStream({
    sevaIds,
    user,
  });

  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "X-Files-Count": String(count),
    },
  });
});
