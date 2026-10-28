import archiver from "archiver";
import { Readable, PassThrough } from "stream";
import { db } from "../db";
import { storage } from "./storage";
import { AuthenticatedUser } from "../permissions/can";
import { can } from "../permissions/can";
import { AppError } from "../http/error";

export function sanitizePathComponent(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "_").trim();
}

export interface ZipExportOptions {
  sevaId: string;
  user: AuthenticatedUser;
  includeSubSeva?: boolean;
}

export async function createSevaZipStream(options: ZipExportOptions): Promise<{
  stream: Readable;
  filename: string;
}> {
  const { sevaId, user, includeSubSeva = true } = options;

  // Retrieve seva
  const rootSeva = await db.seva.findUnique({
    where: { id: sevaId },
    select: { id: true, code: true, title: true, path: true },
  });

  if (!rootSeva) {
    throw new AppError(404, "SEVA_NOT_FOUND", "Seva not found");
  }

  // Get all descendant sevas or single seva
  let sevas: { id: string; code: string; title: string; path: string }[] = [];
  if (includeSubSeva) {
    sevas = await db.seva.findMany({
      where: {
        OR: [{ id: sevaId }, { path: { startsWith: rootSeva.path } }],
        isArchived: false,
      },
      select: { id: true, code: true, title: true, path: true },
      orderBy: { depth: "asc" },
    });
  } else {
    sevas = [rootSeva];
  }

  const sevaMap = new Map(sevas.map((s) => [s.id, s]));
  const sevaIds = sevas.map((s) => s.id);

  // Retrieve files
  const sevaFiles = await db.sevaFile.findMany({
    where: {
      sevaId: { in: sevaIds },
      deletedAt: null,
    },
    include: {
      fileObject: true,
      seva: { select: { id: true, code: true, title: true, path: true } },
    },
  });

  const archive = archiver("zip", { zlib: { level: 6 } });
  const passthrough = new PassThrough();
  archive.pipe(passthrough);

  // Build files in zip asynchronously
  (async () => {
    try {
      for (const sf of sevaFiles) {
        // Enforce permission checks:
        // Quotes requires quotes.view
        if (sf.bucket === "QUOTE" && !can(user, "quotes.view")) {
          continue;
        }
        // Artefacts requires artefacts.view
        if (sf.bucket === "ARTEFACT" && !can(user, "artefacts.view")) {
          continue;
        }

        const exists = await storage.fileExists(sf.fileObject.storageKey);
        if (!exists) continue;

        // Construct readable folder path
        const sevaFolder = `${sf.seva.code}_${sanitizePathComponent(sf.seva.title)}`;
        const bucketFolder = sf.bucket === "QUOTE" ? "Quotes" : "Artefacts";
        const entryName = `${sevaFolder}/${bucketFolder}/${sanitizePathComponent(sf.fileObject.originalName)}`;

        const fileStream = storage.createReadStream(sf.fileObject.storageKey);
        archive.append(fileStream, { name: entryName });
      }

      await archive.finalize();
    } catch (err) {
      archive.emit("error", err);
    }
  })();

  const zipFilename = `${rootSeva.code}_${sanitizePathComponent(rootSeva.title)}_files.zip`;
  return { stream: passthrough, filename: zipFilename };
}
