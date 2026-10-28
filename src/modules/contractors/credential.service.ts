import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { CredentialKind, CredentialStatus, Prisma } from "@prisma/client";
import { CreateCredentialInput, UpdateCredentialInput } from "./schemas";
import { AuthenticatedUser } from "@/core/permissions/can";
import { sanitizeCredential, getContractorTierContext } from "./tiers";

export class CredentialService {
  /**
   * Derive status from expiry date and manual status overrides.
   */
  public static computeStatus(
    expiresAt: Date | null,
    currentStatusOrWarnDays?: CredentialStatus | number,
    warnDaysArg: number = 30
  ): CredentialStatus {
    let currentStatus: CredentialStatus | undefined;
    let warnDays = warnDaysArg;

    if (typeof currentStatusOrWarnDays === "number") {
      warnDays = currentStatusOrWarnDays;
      currentStatus = undefined;
    } else {
      currentStatus = currentStatusOrWarnDays;
    }

    if (currentStatus === "REVOKED" || currentStatus === "PENDING_VERIFICATION") {
      return currentStatus;
    }

    if (!expiresAt) {
      return "VALID";
    }

    const now = new Date();
    if (expiresAt.getTime() < now.getTime()) {
      return "EXPIRED";
    }

    const warnHorizon = new Date();
    warnHorizon.setDate(warnHorizon.getDate() + warnDays);
    if (expiresAt.getTime() <= warnHorizon.getTime()) {
      return "EXPIRING_SOON";
    }

    return "VALID";
  }

  public static async list(contractorId: string, user: AuthenticatedUser) {
    const tierCtx = await getContractorTierContext(user);

    const credentials = await db.contractorCredential.findMany({
      where: { contractorId },
      orderBy: { createdAt: "desc" },
      include: {
        verifiedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return credentials.map((cred) => sanitizeCredential(cred, tierCtx));
  }

  public static async create(contractorId: string, input: CreateCredentialInput, userId: string) {
    const contractor = await db.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const issuedAt = input.issuedAt ? new Date(input.issuedAt) : null;

    // Fetch warn days setting
    const warnSetting = await db.setting.findUnique({ where: { key: "contractorExpiryWarnDays" } });
    const warnDays = typeof warnSetting?.value === "number" ? warnSetting.value : 30;

    const initialStatus = input.status || CredentialService.computeStatus(expiresAt, undefined, warnDays);

    const credential = await db.contractorCredential.create({
      data: {
        contractorId,
        kind: input.kind as CredentialKind,
        type: input.type,
        issuer: input.issuer || null,
        number: input.number || null,
        coverAmount: input.coverAmount !== undefined && input.coverAmount !== null ? new Prisma.Decimal(input.coverAmount) : null,
        issuedAt,
        expiresAt,
        status: initialStatus,
        notes: input.notes || null,
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_CREDENTIAL",
      entityId: credential.id,
      userId,
      action: "CREATE_CONTRACTOR_CREDENTIAL",
      newValue: { type: credential.type, kind: credential.kind, status: credential.status },
    });

    return credential;
  }

  public static async update(credentialId: string, input: UpdateCredentialInput, userId: string) {
    const existing = await db.contractorCredential.findUnique({ where: { id: credentialId } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Credential not found");

    const expiresAt = input.expiresAt !== undefined
      ? (input.expiresAt ? new Date(input.expiresAt) : null)
      : existing.expiresAt;

    const warnSetting = await db.setting.findUnique({ where: { key: "contractorExpiryWarnDays" } });
    const warnDays = typeof warnSetting?.value === "number" ? warnSetting.value : 30;

    const requestedStatus = input.status !== undefined ? (input.status as CredentialStatus) : existing.status;
    const computedStatus = CredentialService.computeStatus(expiresAt, requestedStatus, warnDays);

    const updated = await db.contractorCredential.update({
      where: { id: credentialId },
      data: {
        ...(input.kind !== undefined ? { kind: input.kind as CredentialKind } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.issuer !== undefined ? { issuer: input.issuer } : {}),
        ...(input.number !== undefined ? { number: input.number } : {}),
        ...(input.coverAmount !== undefined
          ? { coverAmount: input.coverAmount !== null ? new Prisma.Decimal(input.coverAmount) : null }
          : {}),
        ...(input.issuedAt !== undefined
          ? { issuedAt: input.issuedAt ? new Date(input.issuedAt) : null }
          : {}),
        ...(input.expiresAt !== undefined ? { expiresAt } : {}),
        status: computedStatus,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_CREDENTIAL",
      entityId: credentialId,
      userId,
      action: "UPDATE_CONTRACTOR_CREDENTIAL",
      oldValue: { type: existing.type, status: existing.status },
      newValue: { type: updated.type, status: updated.status, changes: input },
    });

    return updated;
  }

  public static async verify(credentialId: string, userId: string) {
    const existing = await db.contractorCredential.findUnique({ where: { id: credentialId } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Credential not found");

    const warnSetting = await db.setting.findUnique({ where: { key: "contractorExpiryWarnDays" } });
    const warnDays = typeof warnSetting?.value === "number" ? warnSetting.value : 30;

    const status = CredentialService.computeStatus(existing.expiresAt, "VALID", warnDays);

    const updated = await db.contractorCredential.update({
      where: { id: credentialId },
      data: {
        verifiedById: userId,
        verifiedAt: new Date(),
        status,
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_CREDENTIAL",
      entityId: credentialId,
      userId,
      action: "VERIFY_CONTRACTOR_CREDENTIAL",
      newValue: { verifiedById: userId, verifiedAt: updated.verifiedAt, status },
    });

    return updated;
  }

  public static async delete(credentialId: string, userId: string) {
    const existing = await db.contractorCredential.findUnique({ where: { id: credentialId } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Credential not found");

    const updated = await db.contractorCredential.update({
      where: { id: credentialId },
      data: { status: "REVOKED" },
    });

    await logAudit({
      entityType: "CONTRACTOR_CREDENTIAL",
      entityId: credentialId,
      userId,
      action: "REVOKE_CONTRACTOR_CREDENTIAL",
      newValue: { status: "REVOKED" },
    });

    return updated;
  }
}
