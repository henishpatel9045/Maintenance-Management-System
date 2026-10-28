import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { storage } from "@/core/storage/storage";
import { can } from "@/core/permissions/can";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { Readable } from "stream";

export const runtime = "nodejs";

export const GET = withAuth("files.download", async (req, { user, params }) => {
  const { id } = params as { id: string };

  const sevaFile = await db.sevaFile.findUnique({
    where: { id },
    include: {
      fileObject: true,
      seva: { select: { id: true, code: true, title: true } },
    },
  });

  if (!sevaFile || sevaFile.deletedAt) {
    throw new AppError(404, "FILE_NOT_FOUND", "Requested file does not exist");
  }

  // Permission check for Quotes
  if (sevaFile.bucket === "QUOTE" && !can(user, "quotes.view")) {
    throw new AppError(403, "FORBIDDEN", "You do not have permission to download quotes");
  }

  // Audit document access
  await logAudit({
    entityType: "FILE_DOWNLOAD",
    entityId: id,
    userId: user.id,
    action: "DOWNLOAD_FILE",
    newValue: {
      originalName: sevaFile.fileObject.originalName,
      bucket: sevaFile.bucket,
    },
  });

  const fileSize = await storage.getFileSize(sevaFile.fileObject.storageKey);
  const rangeHeader = req.headers.get("range");

  const isImage = sevaFile.fileObject.mimeType.startsWith("image/");
  const isVideo = sevaFile.fileObject.mimeType.startsWith("video/");
  const isPdf = sevaFile.fileObject.mimeType === "application/pdf";

  // Sanitize filename for Content-Disposition
  const safeFilename = sevaFile.fileObject.originalName.replace(/[/\\?%*:|"<>]/g, "_");
  const disposition = isImage || isVideo || isPdf ? "inline" : "attachment";

  const headers = new Headers();
  headers.set("Content-Type", sevaFile.fileObject.mimeType);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "sandbox");
  headers.set("Content-Disposition", `${disposition}; filename="${safeFilename}"`);
  headers.set("Accept-Ranges", "bytes");

  // HTTP Range request support (especially critical for video seek/playback)
  if (rangeHeader) {
    const parts = rangeHeader.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0] || "0", 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

    if (start >= fileSize || end >= fileSize) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkLength = end - start + 1;
    const stream = storage.createReadStream(sevaFile.fileObject.storageKey, { start, end });

    headers.set("Content-Range", `bytes ${start}-${end}/${fileSize}`);
    headers.set("Content-Length", String(chunkLength));

    // Convert Node ReadStream to Web ReadableStream
    const webStream = Readable.toWeb(stream) as ReadableStream;
    return new NextResponse(webStream, {
      status: 206,
      headers,
    });
  }

  headers.set("Content-Length", String(fileSize));
  const fullStream = storage.createReadStream(sevaFile.fileObject.storageKey);
  const webStream = Readable.toWeb(fullStream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers,
  });
});
