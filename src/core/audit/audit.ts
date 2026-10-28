import crypto from "crypto";
import { db } from "../db";
import { logger } from "../logger";

export interface LogAuditParams {
  entityType: string;
  entityId: string;
  occurrenceId?: string | null;
  userId?: string | null;
  action: string;
  oldValue?: unknown;
  newValue?: unknown;
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(val: string | null | undefined): val is string {
  if (!val || typeof val !== "string") return false;
  return UUID_REGEX.test(val);
}

/**
 * Ensures a value is a valid UUID string for PostgreSQL @db.Uuid columns.
 * If already a valid UUID, returns it unchanged.
 * If not, generates a deterministic UUID (RFC4122 v4/v5 format) from the input string.
 */
export function toValidUuid(val: string): string {
  if (isValidUuid(val)) {
    return val;
  }
  const hash = crypto.createHash("md5").update(val).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    const isEntityUuid = isValidUuid(params.entityId);
    const entityId = isEntityUuid ? params.entityId : toValidUuid(params.entityId);
    const validUserId = isValidUuid(params.userId) ? params.userId : null;
    const validOccurrenceId = isValidUuid(params.occurrenceId) ? params.occurrenceId : null;

    // If the original entityId was a plain string (like "session", "system", email),
    // preserve it in newValue so the exact entity is traceable in the audit record
    let newValue = params.newValue;
    if (!isEntityUuid) {
      if (typeof newValue === "object" && newValue !== null && !Array.isArray(newValue)) {
        newValue = { ...newValue, _rawEntityId: params.entityId };
      } else if (newValue === undefined) {
        newValue = { _rawEntityId: params.entityId };
      }
    }

    await db.activityLog.create({
      data: {
        entityType: params.entityType,
        entityId,
        occurrenceId: validOccurrenceId,
        userId: validUserId,
        action: params.action,
        oldValue: params.oldValue !== undefined ? (params.oldValue as any) : undefined,
        newValue: newValue !== undefined ? (newValue as any) : undefined,
      },
    });
  } catch (err) {
    logger.error({ err, params }, "Failed to write activity audit log");
  }
}

