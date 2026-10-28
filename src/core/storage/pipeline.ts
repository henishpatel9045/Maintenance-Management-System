import crypto from "crypto";
import path from "path";
import sharp from "sharp";
import { storage } from "./storage";
import { db } from "../db";
import { AppError } from "../http/error";
import { FileBucket, FileObject } from "@prisma/client";

const ALLOWED_QUOTE_EXTS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
]);

const ALLOWED_ARTEFACT_EXTS = new Set([
  ...ALLOWED_QUOTE_EXTS,
  ".mp4",
  ".mov",
]);

const DISALLOWED_EXTS = new Set([
  ".svg",
  ".html",
  ".htm",
  ".js",
  ".mjs",
  ".exe",
  ".sh",
  ".bat",
  ".cmd",
  ".ps1",
  ".php",
]);

export interface ProcessedUploadResult {
  fileObject: FileObject;
  isDuplicate: boolean;
}

export async function processFileUpload(params: {
  buffer: Buffer;
  originalName: string;
  bucket: FileBucket;
  sevaCode: string;
  uploadedById?: string;
  settings?: Record<string, unknown>;
}): Promise<ProcessedUploadResult> {
  const { buffer, originalName, bucket, sevaCode, uploadedById, settings = {} } = params;

  // 1. Sanitize original filename and check extension
  const ext = path.extname(originalName).toLowerCase();
  if (DISALLOWED_EXTS.has(ext)) {
    throw new AppError(400, "DISALLOWED_FILE_TYPE", `Executable and dangerous file extensions (${ext}) are prohibited`);
  }

  const allowedExts = bucket === FileBucket.QUOTE ? ALLOWED_QUOTE_EXTS : ALLOWED_ARTEFACT_EXTS;
  if (!allowedExts.has(ext)) {
    throw new AppError(400, "INVALID_EXTENSION", `File extension ${ext} is not allowed in bucket ${bucket}`);
  }

  // 2. Magic-byte MIME sniffing
  let detectedMime = "application/octet-stream";
  try {
    const { fileTypeFromBuffer } = await import("file-type");
    const ft = await fileTypeFromBuffer(buffer);
    if (ft) {
      detectedMime = ft.mime;
    } else if (ext === ".csv" || ext === ".txt") {
      detectedMime = ext === ".csv" ? "text/csv" : "text/plain";
    }
  } catch {
    if (ext === ".csv" || ext === ".txt") {
      detectedMime = ext === ".csv" ? "text/csv" : "text/plain";
    }
  }

  // Block SVG or HTML masquerading
  if (
    detectedMime.includes("svg") ||
    detectedMime.includes("html") ||
    detectedMime.includes("javascript")
  ) {
    throw new AppError(400, "DISALLOWED_MIME_TYPE", `Disallowed content type: ${detectedMime}`);
  }

  // 3. Enforce size limits based on category
  const maxImageMB = Number(settings["maxImageMB"] ?? 10);
  const maxDocMB = Number(settings["maxDocMB"] ?? 25);
  const maxVideoMB = Number(settings["maxVideoMB"] ?? 50);

  const isImage = detectedMime.startsWith("image/");
  const isVideo = detectedMime.startsWith("video/");

  const maxMB = isImage ? maxImageMB : isVideo ? maxVideoMB : maxDocMB;
  if (buffer.length > maxMB * 1024 * 1024) {
    throw new AppError(400, "FILE_TOO_LARGE", `File size exceeds the limit of ${maxMB} MB`);
  }

  // 4. Calculate SHA-256 hash
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  // Check duplicate hash warning
  const existingWithHash = await db.fileObject.findFirst({
    where: { sha256, deletedAt: null },
  });
  const isDuplicate = !!existingWithHash;

  // 5. Image re-encoding with sharp (strips EXIF and GPS)
  let processedBuffer = buffer;
  let width: number | null = null;
  let height: number | null = null;
  let thumbBuffer: Buffer | null = null;

  if (isImage) {
    try {
      const img = sharp(buffer);
      const meta = await img.metadata();
      width = meta.width ?? null;
      height = meta.height ?? null;

      // Re-encode image to strip EXIF/GPS metadata
      if (detectedMime === "image/jpeg" || detectedMime === "image/jpg") {
        processedBuffer = await img.rotate().jpeg({ quality: 85 }).toBuffer();
      } else if (detectedMime === "image/png") {
        processedBuffer = await img.rotate().png({ compressionLevel: 8 }).toBuffer();
      } else if (detectedMime === "image/webp") {
        processedBuffer = await img.rotate().webp({ quality: 85 }).toBuffer();
      }

      // Generate 300x300 WebP thumbnail
      thumbBuffer = await sharp(processedBuffer)
        .resize(300, 300, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      // If sharp cannot process (e.g. text or corrupted image), fail if image expected
      throw new AppError(400, "CORRUPT_IMAGE", "Could not parse or sanitize image file");
    }
  }

  // 6. Generate storage keys & persist
  const fileObjectId = crypto.randomUUID();
  const bucketFolder = bucket === FileBucket.QUOTE ? "quotes" : "artefacts";
  const storageKey = `seva/${sevaCode}/${bucketFolder}/${fileObjectId}${ext}`;
  const thumbnailKey = thumbBuffer ? `seva/${sevaCode}/.thumbs/${fileObjectId}.webp` : null;

  await storage.saveFile(storageKey, processedBuffer);
  if (thumbBuffer && thumbnailKey) {
    await storage.saveFile(thumbnailKey, thumbBuffer);
  }

  // 7. Insert FileObject row in DB
  const fileObject = await db.fileObject.create({
    data: {
      id: fileObjectId,
      storageKey,
      originalName: path.basename(originalName).slice(0, 255),
      mimeType: detectedMime,
      sizeBytes: BigInt(processedBuffer.length),
      sha256,
      width,
      height,
      thumbnailKey,
      uploadedById: uploadedById ?? null,
      scanStatus: "NOT_SCANNED",
    },
  });

  return { fileObject, isDuplicate };
}
