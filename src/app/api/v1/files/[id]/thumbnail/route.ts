import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";
import { storage } from "@/core/storage/storage";
import { AppError } from "@/core/http/error";
import { Readable } from "stream";

export const runtime = "nodejs";

export const GET = withAuth("seva.read", async (_req, { params }) => {
  const { id } = params as { id: string };

  const sevaFile = await db.sevaFile.findUnique({
    where: { id },
    include: { fileObject: true },
  });

  if (!sevaFile || sevaFile.deletedAt || !sevaFile.fileObject.thumbnailKey) {
    throw new AppError(404, "THUMBNAIL_NOT_FOUND", "Thumbnail not found");
  }

  const exists = await storage.fileExists(sevaFile.fileObject.thumbnailKey);
  if (!exists) {
    throw new AppError(404, "THUMBNAIL_NOT_FOUND", "Thumbnail file does not exist on disk");
  }

  const stream = storage.createReadStream(sevaFile.fileObject.thumbnailKey);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
