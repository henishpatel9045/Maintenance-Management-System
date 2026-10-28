import crypto from "crypto";
import path from "path";
import sharp from "sharp";
import { storage } from "@/core/storage/storage";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { LicenceTierContext } from "./tiers";

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

const ALLOWED_EXTS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
]);

export interface LicenceUploadOptions {
  buffer: Buffer;
  originalName: string;
  userId: string;
  licenceId: string;
  kind?: "FRONT" | "BACK" | "PAGE" | "OTHER";
  uploadedById: string;
  settings?: Record<string, unknown>;
}

export class LicenceStorageService {
  /**
   * Upload and process a licence scan or document.
   * Path: data/uploads/licences/<userId>/<licenceId>/<fileObjectId>.<ext>
   */
  public static async uploadLicenceDocument(options: LicenceUploadOptions) {
    const { buffer, originalName, userId, licenceId, kind = "FRONT", uploadedById, settings = {} } = options;

    const ext = path.extname(originalName).toLowerCase();
    if (DISALLOWED_EXTS.has(ext)) {
      throw new AppError(400, "DISALLOWED_FILE_TYPE", `File type ${ext} is blocked for security`);
    }
    if (!ALLOWED_EXTS.has(ext)) {
      throw new AppError(400, "INVALID_EXTENSION", `Only jpg, png, webp, heic, and pdf files are allowed for licence documents`);
    }

    // Magic-byte check
    let detectedMime = "application/octet-stream";
    try {
      const { fileTypeFromBuffer } = await import("file-type");
      const ft = await fileTypeFromBuffer(buffer);
      if (ft) {
        detectedMime = ft.mime;
      }
    } catch {
      // fallback
    }

    if (detectedMime.includes("svg") || detectedMime.includes("html") || detectedMime.includes("javascript")) {
      throw new AppError(400, "DISALLOWED_MIME_TYPE", `Disallowed content type: ${detectedMime}`);
    }

    // Size limit
    const maxDocMB = Number(settings["maxDocMB"] ?? 25);
    if (buffer.length > maxDocMB * 1024 * 1024) {
      throw new AppError(400, "FILE_TOO_LARGE", `File size exceeds ${maxDocMB} MB limit`);
    }

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const isImage = detectedMime.startsWith("image/");

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

        // Re-encode to strip metadata, EXIF and GPS coordinates
        if (detectedMime === "image/jpeg" || detectedMime === "image/jpg") {
          processedBuffer = await img.rotate().jpeg({ quality: 85 }).toBuffer();
        } else if (detectedMime === "image/png") {
          processedBuffer = await img.rotate().png({ compressionLevel: 8 }).toBuffer();
        } else if (detectedMime === "image/webp") {
          processedBuffer = await img.rotate().webp({ quality: 85 }).toBuffer();
        }

        thumbBuffer = await sharp(processedBuffer)
          .resize(300, 300, { fit: "inside", withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer();
      } catch {
        throw new AppError(400, "CORRUPT_IMAGE", "Could not parse or process image file");
      }
    }

    const fileObjectId = crypto.randomUUID();
    const storageKey = `licences/${userId}/${licenceId}/${fileObjectId}${ext}`;
    const thumbnailKey = thumbBuffer ? `licences/${userId}/${licenceId}/.thumbs/${fileObjectId}.webp` : null;

    await storage.saveFile(storageKey, processedBuffer);
    if (thumbBuffer && thumbnailKey) {
      await storage.saveFile(thumbnailKey, thumbBuffer);
    }

    // Insert FileObject
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
        uploadedById,
        scanStatus: "NOT_SCANNED",
      },
    });

    // Create FileLink for USER_LICENCE
    const fileLink = await db.fileLink.create({
      data: {
        fileObjectId: fileObject.id,
        entityType: "USER_LICENCE",
        entityId: licenceId,
        kind,
        label: originalName,
        createdById: uploadedById,
      },
      include: { fileObject: true },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: uploadedById,
      action: "UPLOAD_LICENCE_DOCUMENT",
      newValue: {
        fileObjectId: fileObject.id,
        kind,
        filename: originalName,
      },
    });

    return {
      fileLink: {
        ...fileLink,
        fileObject: {
          ...fileObject,
          sizeBytes: Number(fileObject.sizeBytes),
        },
      },
    };
  }

  /**
   * Retrieves all attached documents for a licence if permitted by tier.
   */
  static async getLicenceDocuments(licenceId: string, tierContext: LicenceTierContext) {
    const licence = await db.userLicence.findUnique({
      where: { id: licenceId },
      include: { licenceType: true },
    });

    if (!licence) {
      throw new AppError(404, "LICENCE_NOT_FOUND", "Licence not found");
    }

    const isOwn = tierContext.userId === licence.userId;
    const isHighlySensitive = licence.licenceType.isHighlySensitive;

    let canViewDocs = false;
    if (isOwn && tierContext.canOwnView) {
      canViewDocs = true;
    } else if (isHighlySensitive) {
      canViewDocs = tierContext.canSensitiveView && tierContext.canDocumentsView;
    } else {
      canViewDocs = tierContext.canDocumentsView || tierContext.canManage;
    }

    if (!canViewDocs) {
      return [];
    }

    const links = await db.fileLink.findMany({
      where: {
        entityType: "USER_LICENCE",
        entityId: licenceId,
      },
      include: { fileObject: true },
      orderBy: { createdAt: "asc" },
    });

    return links.map((l) => ({
      id: l.id,
      kind: l.kind,
      label: l.label,
      createdAt: l.createdAt,
      fileObject: {
        id: l.fileObject.id,
        originalName: l.fileObject.originalName,
        mimeType: l.fileObject.mimeType,
        sizeBytes: Number(l.fileObject.sizeBytes),
        hasThumbnail: Boolean(l.fileObject.thumbnailKey),
      },
    }));
  }

  /**
   * Streams a document with authentication and audit logging.
   */
  static async streamDocument(
    licenceId: string,
    fileLinkId: string,
    tierContext: LicenceTierContext,
    isThumbnail: boolean = false
  ) {
    const licence = await db.userLicence.findUnique({
      where: { id: licenceId },
      include: { licenceType: true },
    });

    if (!licence) {
      throw new AppError(404, "LICENCE_NOT_FOUND", "Licence not found");
    }

    const isOwn = tierContext.userId === licence.userId;
    const isHighlySensitive = licence.licenceType.isHighlySensitive;

    let canViewDocs = false;
    if (isOwn && tierContext.canOwnView) {
      canViewDocs = true;
    } else if (isHighlySensitive) {
      canViewDocs = tierContext.canSensitiveView && tierContext.canDocumentsView;
    } else {
      canViewDocs = tierContext.canDocumentsView || tierContext.canManage;
    }

    if (!canViewDocs) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to view documents for this licence");
    }

    const link = await db.fileLink.findFirst({
      where: {
        id: fileLinkId,
        entityType: "USER_LICENCE",
        entityId: licenceId,
      },
      include: { fileObject: true },
    });

    if (!link) {
      throw new AppError(404, "DOCUMENT_NOT_FOUND", "Document not found");
    }

    const targetKey = isThumbnail && link.fileObject.thumbnailKey
      ? link.fileObject.thumbnailKey
      : link.fileObject.storageKey;

    const stream = storage.createReadStream(targetKey);

    // Audit log document viewing / download
    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: tierContext.userId,
      action: isThumbnail ? "VIEW_LICENCE_THUMBNAIL" : "OPEN_LICENCE_DOCUMENT",
      newValue: {
        licenceOwnerId: licence.userId,
        licenceTypeId: licence.licenceTypeId,
        fileObjectId: link.fileObject.id,
        originalName: link.fileObject.originalName,
      },
    });

    return {
      stream,
      mimeType: isThumbnail ? "image/webp" : link.fileObject.mimeType,
      originalName: link.fileObject.originalName,
      sizeBytes: Number(link.fileObject.sizeBytes),
    };
  }
}
