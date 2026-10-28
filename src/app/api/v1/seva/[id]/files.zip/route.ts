import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { createSevaZipStream } from "@/core/storage/zip";
import { Readable } from "stream";

export const runtime = "nodejs";

export const GET = withAuth("files.download", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const url = new URL(req.url);
  const includeSubSeva = url.searchParams.get("includeSubSeva") !== "false";

  const { stream, filename } = await createSevaZipStream({
    sevaId: id,
    user,
    includeSubSeva,
  });

  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
    },
  });
});
