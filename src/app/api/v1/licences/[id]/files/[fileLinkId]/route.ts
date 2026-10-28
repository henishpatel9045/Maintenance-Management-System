import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import {
  LicenceStorageService,
  ensureLicencesEnabled,
  getLicenceTierContext,
} from "@/modules/licences";
import { AppError } from "@/core/http/error";
import { Readable } from "stream";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string; fileLinkId: string }>({}, async (req, { user, params }) => {
  await ensureLicencesEnabled();
  const licenceId = params.id;
  const fileLinkId = params.fileLinkId;
  if (!licenceId || !fileLinkId) {
    throw new AppError(400, "INVALID_ID", "Licence ID and File Link ID are required");
  }

  const url = new URL(req.url);
  const isThumbnail = url.searchParams.get("thumbnail") === "true";

  const tierContext = getLicenceTierContext(user);
  const { stream, mimeType, originalName, sizeBytes } =
    await LicenceStorageService.streamDocument(licenceId, fileLinkId, tierContext, isThumbnail);

  const safeFilename = originalName.replace(/[/\\?%*:|"<>]/g, "_");
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const disposition = isImage || isPdf ? "inline" : "attachment";

  const headers = new Headers();
  headers.set("Content-Type", mimeType);
  headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox");
  headers.set("Cache-Control", "no-store");
  if (sizeBytes > 0 && !isThumbnail) {
    headers.set("Content-Length", String(sizeBytes));
  }

  const webStream = Readable.toWeb(stream) as ReadableStream;
  return new NextResponse(webStream, {
    status: 200,
    headers,
  });
});
