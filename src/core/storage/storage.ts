import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { config } from "../config";
import { AppError } from "../http/error";

export interface IStorageDriver {
  saveFile(storageKey: string, buffer: Buffer): Promise<void>;
  createReadStream(storageKey: string, options?: { start?: number; end?: number }): fsSync.ReadStream;
  deleteFile(storageKey: string): Promise<void>;
  fileExists(storageKey: string): Promise<boolean>;
  getFileSize(storageKey: string): Promise<number>;
  getAbsolutePath(storageKey: string): string;
}

export class LocalDiskStorageDriver implements IStorageDriver {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir || config.UPLOAD_DIR);
    if (!fsSync.existsSync(this.baseDir)) {
      fsSync.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  public getAbsolutePath(storageKey: string): string {
    const resolved = path.resolve(this.baseDir, storageKey);
    // Strict path traversal defense
    if (!resolved.startsWith(this.baseDir)) {
      throw new AppError(400, "INVALID_STORAGE_PATH", "Path traversal attempt detected");
    }
    return resolved;
  }

  public async saveFile(storageKey: string, buffer: Buffer): Promise<void> {
    const filePath = this.getAbsolutePath(storageKey);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, buffer);
  }

  public createReadStream(storageKey: string, options?: { start?: number; end?: number }): fsSync.ReadStream {
    const filePath = this.getAbsolutePath(storageKey);
    if (!fsSync.existsSync(filePath)) {
      throw new AppError(404, "FILE_NOT_FOUND", "Requested file does not exist on disk");
    }
    return fsSync.createReadStream(filePath, options);
  }

  public async deleteFile(storageKey: string): Promise<void> {
    const filePath = this.getAbsolutePath(storageKey);
    try {
      await fs.unlink(filePath);
    } catch {
      // Ignore if already deleted
    }
  }

  public async fileExists(storageKey: string): Promise<boolean> {
    const filePath = this.getAbsolutePath(storageKey);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  public async getFileSize(storageKey: string): Promise<number> {
    const filePath = this.getAbsolutePath(storageKey);
    const stat = await fs.stat(filePath);
    return stat.size;
  }
}

export const storage = new LocalDiskStorageDriver();

export function sanitizePathComponent(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}
