import crypto from "crypto";
import path from "path";
import sharp from "sharp";
import archiver from "archiver";
import { PassThrough, Readable } from "stream";
import { storage, sanitizePathComponent } from "@/core/storage/storage";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { AuthenticatedUser, can } from "@/core/permissions/can";

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
  ".docx",
  ".xlsx",
  ".csv",
  ".txt",
]);

export interface ContractorUploadOptions {
  buffer: Buffer;
  originalName: string;
  contractorCode: string;
  kind: "CREDENTIAL" | "INSURANCE" | "CONTRACT" | "INVOICE" | "QUOTE" | "ID" | "OTHER";
  label?: string | null;
  expiresAt?: Date | null;
  uploadedById: string;
  settings?: Record<string, unknown>;
  credentialId?: string | null;
}

export interface RequestUploadOptions {
  buffer: Buffer;
  originalName: string;
  requestCode: string;
  uploadedById: string;
  settings?: Record<string, unknown>;
}

export class ContractorStorageService {
  /**
   * Process and persist a document for a Contractor.
   * Path: data/uploads/contractors/CON-XXXX/<folder>/<fileObjectId>.<ext>
   */
  public static async uploadContractorDocument(options: ContractorUploadOptions) {
    const { buffer, originalName, contractorCode, kind, label, expiresAt, uploadedById, settings = {}, credentialId } = options;

    const ext = path.extname(originalName).toLowerCase();
    if (DISALLOWED_EXTS.has(ext)) {
      throw new AppError(400, "DISALLOWED_FILE_TYPE", `File type ${ext} is blocked for security`);
    }
    if (!ALLOWED_EXTS.has(ext)) {
      throw new AppError(400, "INVALID_EXTENSION", `File type ${ext} is not accepted for contractor documents`);
    }

    // Magic-byte check
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
    const folderName = kind.toLowerCase();
    const storageKey = `contractors/${contractorCode}/${folderName}/${fileObjectId}${ext}`;
    const thumbnailKey = thumbBuffer ? `contractors/${contractorCode}/.thumbs/${fileObjectId}.webp` : null;

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

    // Lookup contractor
    const contractor = await db.contractor.findUnique({
      where: { code: contractorCode },
      select: { id: true },
    });
    if (!contractor) throw new AppError(404, "CONTRACTOR_NOT_FOUND", "Contractor not found");

    // Create FileLink for contractor
    const fileLink = await db.fileLink.create({
      data: {
        fileObjectId: fileObject.id,
        entityType: "CONTRACTOR",
        entityId: contractor.id,
        kind,
        label: label || originalName,
        expiresAt: expiresAt ?? null,
        createdById: uploadedById,
      },
      include: { fileObject: true },
    });

    // If tied to a specific credential, also link to the credential
    if (credentialId) {
      await db.fileLink.create({
        data: {
          fileObjectId: fileObject.id,
          entityType: "CONTRACTOR_CREDENTIAL",
          entityId: credentialId,
          kind,
          label: label || originalName,
          expiresAt: expiresAt ?? null,
          createdById: uploadedById,
        },
      });
    }

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: contractor.id,
      userId: uploadedById,
      action: "UPLOAD_CONTRACTOR_DOCUMENT",
      newValue: {
        fileObjectId: fileObject.id,
        kind,
        originalName,
      },
    });

    return { fileLink, fileObject };
  }

  /**
   * Process and persist a supporting document for a Contractor Request.
   * Path: data/uploads/contractor-requests/CRQ-XXXX/<fileObjectId>.<ext>
   */
  public static async uploadRequestDocument(options: RequestUploadOptions) {
    const { buffer, originalName, requestCode, uploadedById, settings = {} } = options;

    const ext = path.extname(originalName).toLowerCase();
    if (DISALLOWED_EXTS.has(ext)) {
      throw new AppError(400, "DISALLOWED_FILE_TYPE", `File type ${ext} is prohibited`);
    }
    if (!ALLOWED_EXTS.has(ext)) {
      throw new AppError(400, "INVALID_EXTENSION", `File type ${ext} is not allowed for request uploads`);
    }

    let detectedMime = "application/octet-stream";
    try {
      const { fileTypeFromBuffer } = await import("file-type");
      const ft = await fileTypeFromBuffer(buffer);
      if (ft) detectedMime = ft.mime;
      else if (ext === ".csv" || ext === ".txt") detectedMime = ext === ".csv" ? "text/csv" : "text/plain";
    } catch {
      if (ext === ".csv" || ext === ".txt") detectedMime = ext === ".csv" ? "text/csv" : "text/plain";
    }

    if (detectedMime.includes("svg") || detectedMime.includes("html") || detectedMime.includes("javascript")) {
      throw new AppError(400, "DISALLOWED_MIME_TYPE", `Disallowed content type: ${detectedMime}`);
    }

    const maxDocMB = Number(settings["maxDocMB"] ?? 25);
    if (buffer.length > maxDocMB * 1024 * 1024) {
      throw new AppError(400, "FILE_TOO_LARGE", `File size exceeds ${maxDocMB} MB limit`);
    }

    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    const fileObjectId = crypto.randomUUID();
    const storageKey = `contractor-requests/${requestCode}/${fileObjectId}${ext}`;

    await storage.saveFile(storageKey, buffer);

    const fileObject = await db.fileObject.create({
      data: {
        id: fileObjectId,
        storageKey,
        originalName: path.basename(originalName).slice(0, 255),
        mimeType: detectedMime,
        sizeBytes: BigInt(buffer.length),
        sha256,
        uploadedById,
        scanStatus: "NOT_SCANNED",
      },
    });

    const request = await db.contractorRequest.findUnique({
      where: { code: requestCode },
      select: { id: true },
    });
    if (!request) throw new AppError(404, "REQUEST_NOT_FOUND", "Request not found");

    const fileLink = await db.fileLink.create({
      data: {
        fileObjectId: fileObject.id,
        entityType: "CONTRACTOR_REQUEST",
        entityId: request.id,
        kind: "SUPPORTING_DOC",
        label: originalName,
        createdById: uploadedById,
      },
      include: { fileObject: true },
    });

    return { fileLink, fileObject };
  }

  /**
   * Generates a streaming ZIP archive of all documents for a contractor.
   */
  public static async createContractorZipStream(contractorId: string, user: AuthenticatedUser): Promise<{
    stream: Readable;
    filename: string;
  }> {
    if (!can(user, "contractors.documents.view")) {
      throw new AppError(403, "FORBIDDEN", "You do not have permission to download contractor documents");
    }

    const contractor = await db.contractor.findUnique({
      where: { id: contractorId },
      select: { id: true, code: true, companyName: true },
    });
    if (!contractor) throw new AppError(404, "CONTRACTOR_NOT_FOUND", "Contractor not found");

    const links = await db.fileLink.findMany({
      where: {
        entityType: "CONTRACTOR",
        entityId: contractor.id,
      },
      include: { fileObject: true },
    });

    const archive = archiver("zip", { zlib: { level: 6 } });
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    (async () => {
      try {
        for (const link of links) {
          const exists = await storage.fileExists(link.fileObject.storageKey);
          if (!exists) continue;

          const folder = sanitizePathComponent(link.kind.toLowerCase());
          const fileName = sanitizePathComponent(link.fileObject.originalName);
          const entryName = `${contractor.code}_${sanitizePathComponent(contractor.companyName)}/${folder}/${fileName}`;

          const fileStream = storage.createReadStream(link.fileObject.storageKey);
          archive.append(fileStream, { name: entryName });
        }
        await archive.finalize();
      } catch (err) {
        archive.emit("error", err);
      }
    })();

    const zipFilename = `${contractor.code}_${sanitizePathComponent(contractor.companyName)}_documents.zip`;

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: contractor.id,
      userId: user.id,
      action: "DOWNLOAD_CONTRACTOR_ZIP",
      newValue: { documentCount: links.length },
    });

    return { stream: passthrough, filename: zipFilename };
  }

  /**
   * List all documents linked to a contractor.
   */
  public static async listContractorFiles(contractorId: string) {
    return db.fileLink.findMany({
      where: {
        entityType: "CONTRACTOR",
        entityId: contractorId,
      },
      include: {
        fileObject: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Update label or expiry date on a file link.
   */
  public static async updateFileLink(
    fileLinkId: string,
    data: { label?: string | null; kind?: string; expiresAt?: Date | null },
    userId: string
  ) {
    const existing = await db.fileLink.findUnique({
      where: { id: fileLinkId },
    });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Document link not found");

    const updated = await db.fileLink.update({
      where: { id: fileLinkId },
      data: {
        label: data.label !== undefined ? data.label : undefined,
        kind: data.kind !== undefined ? data.kind : undefined,
        expiresAt: data.expiresAt !== undefined ? data.expiresAt : undefined,
      },
      include: { fileObject: true },
    });

    await logAudit({
      entityType: "CONTRACTOR_DOCUMENT",
      entityId: fileLinkId,
      userId,
      action: "UPDATE_CONTRACTOR_DOCUMENT",
      newValue: data,
    });

    return updated;
  }

  /**
   * Delete a file link.
   */
  public static async deleteFileLink(fileLinkId: string, userId: string) {
    const existing = await db.fileLink.findUnique({
      where: { id: fileLinkId },
      include: { fileObject: true },
    });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Document link not found");

    await db.fileLink.delete({ where: { id: fileLinkId } });

    await logAudit({
      entityType: "CONTRACTOR_DOCUMENT",
      entityId: fileLinkId,
      userId,
      action: "DELETE_CONTRACTOR_DOCUMENT",
      newValue: { originalName: existing.fileObject.originalName },
    });

    return { success: true };
  }

  /**
   * Stream a contractor file with audit logging for sensitive credential/ID access.
   */
  public static async streamFile(fileLinkId: string, user: AuthenticatedUser) {
    const link = await db.fileLink.findUnique({
      where: { id: fileLinkId },
      include: { fileObject: true },
    });

    if (!link) throw new AppError(404, "NOT_FOUND", "Document link not found");

    // Write audit log entry when opening or downloading a credential or ID document
    if (["CREDENTIAL", "INSURANCE", "ID"].includes(link.kind)) {
      await logAudit({
        entityType: "CONTRACTOR_CREDENTIAL_DOCUMENT",
        entityId: link.id,
        userId: user.id,
        action: "VIEW_CREDENTIAL_DOCUMENT",
        newValue: {
          fileObjectId: link.fileObjectId,
          kind: link.kind,
          originalName: link.fileObject.originalName,
        },
      });
    }

    const stream = storage.createReadStream(link.fileObject.storageKey);
    return {
      stream,
      mimeType: link.fileObject.mimeType,
      filename: link.fileObject.originalName,
      sizeBytes: Number(link.fileObject.sizeBytes),
    };
  }

  /**
   * Stream a document thumbnail if one exists.
   */
  public static async streamThumbnail(fileLinkId: string) {
    const link = await db.fileLink.findUnique({
      where: { id: fileLinkId },
      include: { fileObject: true },
    });

    if (!link) throw new AppError(404, "NOT_FOUND", "Document link not found");

    const dirname = path.dirname(link.fileObject.storageKey);
    const thumbKey = `${dirname}/.thumbs/${link.fileObject.id}.webp`;

    const exists = await storage.fileExists(thumbKey);
    if (!exists) {
      // Fallback to original image stream if image
      if (link.fileObject.mimeType.startsWith("image/")) {
        return {
          stream: storage.createReadStream(link.fileObject.storageKey),
          mimeType: link.fileObject.mimeType,
        };
      }
      throw new AppError(404, "NOT_FOUND", "Thumbnail not found");
    }

    return {
      stream: storage.createReadStream(thumbKey),
      mimeType: "image/webp",
    };
  }
}
