import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { UserLicenceStatus, UserLicenceSource } from "@prisma/client";

export async function ensureLicencesEnabled() {
  const setting = await db.setting.findUnique({
    where: { key: "module.licences.enabled" },
  });
  if (setting && setting.value === false) {
    throw new AppError(404, "NOT_FOUND", "Licences module is disabled");
  }
}

export class LicenceService {
  /**
   * Retrieves all licences for the current authenticated user (own view).
   */
  static async getOwnLicences(userId: string) {
    const licences = await db.userLicence.findMany({
      where: {
        userId,
        archivedAt: null,
      },
      include: {
        licenceType: {
          include: { category: true },
        },
      },
      orderBy: [
        { supersededById: "asc" }, // non-superseded first
        { createdAt: "desc" },
      ],
    });

    return licences.map((lic) => ({
      ...lic,
      isOwn: true,
      isMasked: false,
    }));
  }

  /**
   * Submits a new licence for verification (Self-Service).
   * Enforces quotas and rate limits from system settings.
   */
  static async submitOwnLicence(
    userId: string,
    data: {
      licenceTypeId: string;
      class?: string | null;
      licenceNumber?: string | null;
      issuer?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
      conditions?: string | null;
      notes?: string | null;
    },
    settings: Record<string, unknown> = {}
  ) {
    // 1. Quota check: max pending submissions per user
    const maxPending = Number(settings["licenceSubmitMaxPendingPerUser"] ?? 5);
    const openPendingCount = await db.userLicence.count({
      where: {
        userId,
        status: UserLicenceStatus.PENDING_VERIFICATION,
        archivedAt: null,
      },
    });

    if (openPendingCount >= maxPending) {
      throw new Error(`You have reached the maximum of ${maxPending} pending licence submissions. Please wait for an administrator to review your existing submissions.`);
    }

    // 2. Rate limit check: max submissions per day
    const maxPerDay = Number(settings["licenceSubmitMaxPerDay"] ?? 10);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentSubmissionsCount = await db.userLicence.count({
      where: {
        userId,
        source: UserLicenceSource.SELF_SUBMITTED,
        createdAt: { gte: dayAgo },
      },
    });

    if (recentSubmissionsCount >= maxPerDay) {
      throw new Error(`Daily submission limit reached (${maxPerDay} per day). Please try again tomorrow.`);
    }

    // 3. Verify licence type exists and is active
    const licenceType = await db.licenceType.findUnique({
      where: { id: data.licenceTypeId },
    });
    if (!licenceType || !licenceType.isActive) {
      throw new Error("The specified licence type is invalid or inactive.");
    }

    // 4. Validate class if licence type defines allowed classes
    if (licenceType.classes.length > 0 && data.class) {
      const match = licenceType.classes.some(
        (c) => c.toLowerCase() === data.class?.toLowerCase()
      );
      if (!match) {
        throw new Error(`Class "${data.class}" is not valid for ${licenceType.name}. Allowed classes: ${licenceType.classes.join(", ")}`);
      }
    }

    // 5. Create PENDING_VERIFICATION licence record
    const newLicence = await db.userLicence.create({
      data: {
        userId,
        licenceTypeId: data.licenceTypeId,
        class: data.class || null,
        licenceNumber: data.licenceNumber || null,
        issuer: data.issuer || licenceType.issuer || null,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        conditions: data.conditions || null,
        notes: data.notes || null,
        status: UserLicenceStatus.PENDING_VERIFICATION,
        source: UserLicenceSource.SELF_SUBMITTED,
        version: 1,
      },
      include: {
        licenceType: { include: { category: true } },
      },
    });

    // 6. Notify users with licences.verify permission
    const verifiers = await db.user.findMany({
      where: {
        isActive: true,
        OR: [
          { role: { permissions: { some: { permissionKey: "licences.verify" } } } },
          { permissionOverrides: { some: { permissionKey: "licences.verify", granted: true } } },
        ],
      },
      select: { id: true },
    });

    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    const submitterName = user?.name || "A user";

    for (const v of verifiers) {
      await db.notification.create({
        data: {
          userId: v.id,
          type: "LICENCE_SUBMITTED",
          title: "New Licence Submitted for Verification",
          body: `${submitterName} has submitted a ${licenceType.name} licence for review.`,
          entityType: "USER_LICENCE",
          entityId: newLicence.id,
          linkUrl: `/licences/verify?id=${newLicence.id}`,
        },
      });
    }

    // 7. Audit log
    await logAudit({
      entityType: "USER_LICENCE",
      entityId: newLicence.id,
      userId,
      action: "SUBMIT_LICENCE",
      newValue: {
        licenceTypeId: newLicence.licenceTypeId,
        class: newLicence.class,
        source: newLicence.source,
      },
    });

    return {
      ...newLicence,
      isOwn: true,
      isMasked: false,
    };
  }

  /**
   * Withdraw a pending self-submission.
   */
  static async withdrawSubmission(userId: string, licenceId: string) {
    const existing = await db.userLicence.findUnique({
      where: { id: licenceId },
    });

    if (!existing || existing.userId !== userId) {
      throw new Error("Licence record not found or access denied.");
    }

    if (existing.status !== UserLicenceStatus.PENDING_VERIFICATION) {
      throw new Error("Only pending submissions can be withdrawn.");
    }

    // Soft delete / archive
    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        archivedAt: new Date(),
        status: UserLicenceStatus.REJECTED,
        rejectionReason: "Withdrawn by user",
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId,
      action: "WITHDRAW_LICENCE_SUBMISSION",
    });

    return updated;
  }

  /**
   * Renews a licence by creating a new version and marking the old record as SUPERSEDED.
   * Atomically executed in a transaction to guarantee data integrity and history retention.
   */
  static async renewLicence(
    actorUserId: string,
    targetLicenceId: string,
    data: {
      class?: string | null;
      licenceNumber?: string | null;
      issuer?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
      conditions?: string | null;
      notes?: string | null;
    },
    isSelfService: boolean = false
  ) {
    return await db.$transaction(async (tx) => {
      const existing = await tx.userLicence.findUnique({
        where: { id: targetLicenceId },
        include: { licenceType: true },
      });

      if (!existing || existing.archivedAt != null) {
        throw new Error("Existing licence record not found or has been archived.");
      }

      if (isSelfService && existing.userId !== actorUserId) {
        throw new Error("You can only renew your own licences.");
      }

      const newStatus = isSelfService
        ? UserLicenceStatus.PENDING_VERIFICATION
        : UserLicenceStatus.VALID;

      const newSource = isSelfService
        ? UserLicenceSource.SELF_SUBMITTED
        : UserLicenceSource.ADMIN_ENTERED;

      // 1. Temporarily mark old record as SUPERSEDED with supersededById pointing to itself
      // This satisfies the foreign key while immediately satisfying the partial unique index
      // WHERE archived_at IS NULL AND superseded_by_id IS NULL
      await tx.userLicence.update({
        where: { id: existing.id },
        data: {
          status: UserLicenceStatus.SUPERSEDED,
          supersededById: existing.id,
          version: existing.version + 1,
        },
      });

      // 2. Create the renewed record
      const newRecord = await tx.userLicence.create({
        data: {
          userId: existing.userId,
          licenceTypeId: existing.licenceTypeId,
          class: data.class !== undefined ? data.class : existing.class,
          licenceNumber: data.licenceNumber !== undefined ? data.licenceNumber : existing.licenceNumber,
          issuer: data.issuer !== undefined ? data.issuer : existing.issuer,
          issuedAt: data.issuedAt ? new Date(data.issuedAt) : existing.issuedAt,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : existing.expiresAt,
          conditions: data.conditions !== undefined ? data.conditions : existing.conditions,
          notes: data.notes !== undefined ? data.notes : existing.notes,
          status: newStatus,
          source: newSource,
          verifiedById: isSelfService ? null : actorUserId,
          verifiedAt: isSelfService ? null : new Date(),
          version: 1,
        },
        include: { licenceType: { include: { category: true } } },
      });

      // 3. Update old record with the actual new record id
      await tx.userLicence.update({
        where: { id: existing.id },
        data: {
          supersededById: newRecord.id,
        },
      });

      await logAudit({
        entityType: "USER_LICENCE",
        entityId: newRecord.id,
        userId: actorUserId,
        action: "RENEW_LICENCE",
        oldValue: { supersededId: existing.id, previousStatus: existing.status },
        newValue: { newLicenceId: newRecord.id, status: newRecord.status },
      });

      return newRecord;
    });
  }

  /**
   * Admin creates a licence record directly for a user.
   */
  static async adminCreateLicence(
    adminUserId: string,
    data: {
      userId: string;
      licenceTypeId: string;
      class?: string | null;
      licenceNumber?: string | null;
      issuer?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
      conditions?: string | null;
      notes?: string | null;
      status?: UserLicenceStatus;
      source?: UserLicenceSource;
    }
  ) {
    const licenceType = await db.licenceType.findUnique({
      where: { id: data.licenceTypeId },
    });
    if (!licenceType || !licenceType.isActive) {
      throw new Error("Invalid or inactive licence type.");
    }

    if (licenceType.classes.length > 0 && data.class) {
      const match = licenceType.classes.some(
        (c) => c.toLowerCase() === data.class?.toLowerCase()
      );
      if (!match) {
        throw new Error(`Class "${data.class}" is not valid for ${licenceType.name}. Allowed: ${licenceType.classes.join(", ")}`);
      }
    }

    const status = data.status || UserLicenceStatus.VALID;
    const isVerified = status === UserLicenceStatus.VALID || status === UserLicenceStatus.EXPIRING_SOON;

    const record = await db.userLicence.create({
      data: {
        userId: data.userId,
        licenceTypeId: data.licenceTypeId,
        class: data.class || null,
        licenceNumber: data.licenceNumber || null,
        issuer: data.issuer || licenceType.issuer || null,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
        conditions: data.conditions || null,
        notes: data.notes || null,
        status,
        source: data.source || UserLicenceSource.ADMIN_ENTERED,
        verifiedById: isVerified ? adminUserId : null,
        verifiedAt: isVerified ? new Date() : null,
        version: 1,
      },
      include: {
        licenceType: { include: { category: true } },
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: record.id,
      userId: adminUserId,
      action: "CREATE_USER_LICENCE",
      newValue: {
        userId: record.userId,
        licenceTypeId: record.licenceTypeId,
        class: record.class,
        status: record.status,
      },
    });

    return record;
  }

  /**
   * Admin updates an existing licence with optimistic locking.
   */
  static async adminUpdateLicence(
    adminUserId: string,
    licenceId: string,
    data: {
      class?: string | null;
      licenceNumber?: string | null;
      issuer?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
      conditions?: string | null;
      notes?: string | null;
      status?: UserLicenceStatus;
      expectedVersion?: number;
    }
  ) {
    const existing = await db.userLicence.findUnique({
      where: { id: licenceId },
      include: { licenceType: true },
    });

    if (!existing || existing.archivedAt != null) {
      throw new Error("Licence record not found or has been archived.");
    }

    if (data.expectedVersion !== undefined && existing.version !== data.expectedVersion) {
      throw new Error(`Conflict: This licence has been modified by another transaction. Expected version ${data.expectedVersion}, current version is ${existing.version}. Please refresh.`);
    }

    if (data.class && existing.licenceType.classes.length > 0) {
      const match = existing.licenceType.classes.some(
        (c) => c.toLowerCase() === data.class?.toLowerCase()
      );
      if (!match) {
        throw new Error(`Class "${data.class}" is not valid for ${existing.licenceType.name}.`);
      }
    }

    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        class: data.class !== undefined ? data.class : existing.class,
        licenceNumber: data.licenceNumber !== undefined ? data.licenceNumber : existing.licenceNumber,
        issuer: data.issuer !== undefined ? data.issuer : existing.issuer,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : existing.issuedAt,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : existing.expiresAt,
        conditions: data.conditions !== undefined ? data.conditions : existing.conditions,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        status: data.status !== undefined ? data.status : existing.status,
        version: existing.version + 1,
      },
      include: {
        licenceType: { include: { category: true } },
        user: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: adminUserId,
      action: "UPDATE_USER_LICENCE",
      oldValue: { status: existing.status, class: existing.class },
      newValue: { status: updated.status, class: updated.class },
    });

    return updated;
  }

  /**
   * Verifies a pending licence submission.
   */
  static async verifyLicence(
    verifierUserId: string,
    licenceId: string,
    data: {
      status?: "VALID" | "EXPIRING_SOON";
      notes?: string | null;
      expectedVersion?: number;
    }
  ) {
    const existing = await db.userLicence.findUnique({
      where: { id: licenceId },
      include: { licenceType: true },
    });

    if (!existing || existing.archivedAt != null) {
      throw new Error("Licence record not found.");
    }

    if (data.expectedVersion !== undefined && existing.version !== data.expectedVersion) {
      throw new Error(`Conflict: Licence was updated concurrently. Expected version ${data.expectedVersion}, got ${existing.version}.`);
    }

    const targetStatus = data.status || UserLicenceStatus.VALID;

    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        status: targetStatus,
        verifiedById: verifierUserId,
        verifiedAt: new Date(),
        rejectionReason: null,
        notes: data.notes !== undefined ? data.notes : existing.notes,
        version: existing.version + 1,
      },
      include: { licenceType: true },
    });

    // Notify holder
    await db.notification.create({
      data: {
        userId: existing.userId,
        type: "LICENCE_VERIFIED",
        title: "Licence Verified",
        body: `Your ${existing.licenceType.name} licence has been verified and is now active.`,
        entityType: "USER_LICENCE",
        entityId: licenceId,
        linkUrl: "/licences/my",
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: verifierUserId,
      action: "VERIFY_LICENCE",
      newValue: { status: updated.status, verifiedById: verifierUserId },
    });

    return updated;
  }

  /**
   * Rejects a pending licence submission with a mandatory reason.
   */
  static async rejectLicence(
    verifierUserId: string,
    licenceId: string,
    data: {
      rejectionReason: string;
      expectedVersion?: number;
    }
  ) {
    const existing = await db.userLicence.findUnique({
      where: { id: licenceId },
      include: { licenceType: true },
    });

    if (!existing || existing.archivedAt != null) {
      throw new Error("Licence record not found.");
    }

    if (data.expectedVersion !== undefined && existing.version !== data.expectedVersion) {
      throw new Error(`Conflict: Expected version ${data.expectedVersion}, current is ${existing.version}.`);
    }

    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        status: UserLicenceStatus.REJECTED,
        rejectionReason: data.rejectionReason,
        verifiedById: verifierUserId,
        verifiedAt: new Date(),
        version: existing.version + 1,
      },
      include: { licenceType: true },
    });

    // Notify holder
    await db.notification.create({
      data: {
        userId: existing.userId,
        type: "LICENCE_REJECTED",
        title: "Licence Submission Rejected",
        body: `Your ${existing.licenceType.name} submission could not be verified. Reason: ${data.rejectionReason}`,
        entityType: "USER_LICENCE",
        entityId: licenceId,
        linkUrl: "/licences/my",
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: verifierUserId,
      action: "REJECT_LICENCE",
      newValue: { status: updated.status, rejectionReason: data.rejectionReason },
    });

    return updated;
  }

  /**
   * Suspends a licence.
   */
  static async suspendLicence(
    adminUserId: string,
    licenceId: string,
    reason: string,
    expectedVersion?: number
  ) {
    const existing = await db.userLicence.findUnique({ where: { id: licenceId } });
    if (!existing || existing.archivedAt != null) throw new Error("Licence not found.");
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error("Concurrent update conflict.");
    }

    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        status: UserLicenceStatus.SUSPENDED,
        notes: existing.notes ? `${existing.notes}\n[Suspended: ${reason}]` : `[Suspended: ${reason}]`,
        version: existing.version + 1,
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: adminUserId,
      action: "SUSPEND_LICENCE",
      newValue: { reason },
    });

    return updated;
  }

  /**
   * Revokes a licence.
   */
  static async revokeLicence(
    adminUserId: string,
    licenceId: string,
    reason: string,
    expectedVersion?: number
  ) {
    const existing = await db.userLicence.findUnique({ where: { id: licenceId } });
    if (!existing || existing.archivedAt != null) throw new Error("Licence not found.");
    if (expectedVersion !== undefined && existing.version !== expectedVersion) {
      throw new Error("Concurrent update conflict.");
    }

    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        status: UserLicenceStatus.REVOKED,
        rejectionReason: reason,
        version: existing.version + 1,
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: adminUserId,
      action: "REVOKE_LICENCE",
      newValue: { reason },
    });

    return updated;
  }

  /**
   * Soft-archives a licence.
   */
  static async archiveLicence(adminUserId: string, licenceId: string) {
    const updated = await db.userLicence.update({
      where: { id: licenceId },
      data: {
        archivedAt: new Date(),
      },
    });

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId: adminUserId,
      action: "ARCHIVE_LICENCE",
    });

    return updated;
  }

  /**
   * Reveals a masked licence number, generating an audit log entry.
   */
  static async revealLicenceNumber(userId: string, licenceId: string) {
    const licence = await db.userLicence.findUnique({
      where: { id: licenceId },
      select: {
        id: true,
        userId: true,
        licenceTypeId: true,
        licenceNumber: true,
      },
    });

    if (!licence) {
      throw new Error("Licence not found.");
    }

    await logAudit({
      entityType: "USER_LICENCE",
      entityId: licenceId,
      userId,
      action: "REVEAL_LICENCE_NUMBER",
      newValue: {
        licenceOwnerId: licence.userId,
        licenceTypeId: licence.licenceTypeId,
      },
    });

    return {
      licenceId: licence.id,
      licenceNumber: licence.licenceNumber,
    };
  }

  /**
   * Retrieves pending verification queue.
   */
  static async getPendingVerificationQueue() {
    return await db.userLicence.findMany({
      where: {
        status: UserLicenceStatus.PENDING_VERIFICATION,
        archivedAt: null,
      },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        licenceType: { include: { category: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }
}
