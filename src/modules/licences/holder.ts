/**
 * Canonical Definition of a Licence "Holder":
 * 
 * An active user with a non-superseded, non-archived UserLicence of that type
 * whose status is VALID or EXPIRING_SOON and which is verified (not pending).
 * 
 * A user counts once per licence type even if they hold several classes
 * (the class filter counts per class).
 * 
 * Setting countPendingAsHolders (default false) can include pending ones.
 * For a given future date D (such as a seva due date), a licence counts only
 * if expiresAt is empty or on or after D.
 */

export interface LicenceLike {
  id?: string;
  userId: string;
  licenceTypeId: string;
  class?: string | null;
  status: string;
  expiresAt?: Date | string | null;
  issuedAt?: Date | string | null;
  verifiedAt?: Date | string | null;
  archivedAt?: Date | string | null;
  supersededById?: string | null;
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    isActive: boolean;
  } | null;
}

export interface HolderCheckOptions {
  includePending?: boolean;
  classRequired?: string | null;
}

/**
 * Checks whether a single licence record is valid on a specified target date D.
 */
export function isLicenceValidOnDate(
  licence: LicenceLike,
  onDate: Date = new Date(),
  options: HolderCheckOptions = {}
): boolean {
  // 1. Must not be archived
  if (licence.archivedAt != null) {
    return false;
  }

  // 2. Must not be superseded by a newer version
  if (licence.supersededById != null) {
    return false;
  }

  // 3. User must be active (if user object is attached)
  if (licence.user && !licence.user.isActive) {
    return false;
  }

  // 4. Class matching if a specific class is required
  if (options.classRequired && options.classRequired.trim().length > 0) {
    if (!licence.class || licence.class.trim().toLowerCase() !== options.classRequired.trim().toLowerCase()) {
      return false;
    }
  }

  // 5. Verification / Status check
  const isPending = licence.status === "PENDING_VERIFICATION";
  if (isPending) {
    if (!options.includePending) {
      return false;
    }
  } else {
    // Non-pending must be VALID or EXPIRING_SOON and must be verified
    const isStatusEligible = licence.status === "VALID" || licence.status === "EXPIRING_SOON";
    if (!isStatusEligible) {
      return false;
    }
    if (!licence.verifiedAt) {
      return false;
    }
  }

  // 6. Expiry check: for given date D, licence counts only if expiresAt is empty or on or after D
  if (licence.expiresAt) {
    const expiry = new Date(licence.expiresAt);
    const target = new Date(onDate);
    const targetStartUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate(), 0, 0, 0, 0);
    const expiryEndUtc = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate(), 23, 59, 59, 999);

    if (expiryEndUtc < targetStartUtc) {
      return false;
    }
  }

  return true;
}

/**
 * Filters a list of licences to those that are valid on a given date.
 */
export function filterValidLicences<T extends LicenceLike>(
  licences: T[],
  onDate: Date = new Date(),
  options: HolderCheckOptions = {}
): T[] {
  return licences.filter((lic) => isLicenceValidOnDate(lic, onDate, options));
}

/**
 * Returns distinct user IDs who qualify as holders of a licence type on a given date.
 * A user counts once per licence type even if they hold several classes.
 */
export function getDistinctHolderUserIds(
  licences: LicenceLike[],
  onDate: Date = new Date(),
  options: HolderCheckOptions = {}
): Set<string> {
  const holderIds = new Set<string>();
  for (const lic of licences) {
    if (isLicenceValidOnDate(lic, onDate, options)) {
      holderIds.add(lic.userId);
    }
  }
  return holderIds;
}

/**
 * Counts unique holders for a licence type on a given date.
 */
export function countValidHolders(
  licences: LicenceLike[],
  onDate: Date = new Date(),
  options: HolderCheckOptions = {}
): number {
  return getDistinctHolderUserIds(licences, onDate, options).size;
}

/**
 * Checks whether an active user is a valid holder of the given licence.
 */
export function isUserValidHolder(
  user: { id: string; isActive: boolean },
  licence: LicenceLike,
  options: HolderCheckOptions = {}
): boolean {
  if (!user.isActive) return false;
  return isLicenceValidOnDate({ ...licence, user }, new Date(), options);
}

/**
 * Derives UserLicenceStatus from expiresAt and warnDays setting.
 */
export function deriveUserLicenceStatus(
  expiresAt: Date | string | null | undefined,
  warnDays: number = 30,
  referenceDate: Date = new Date()
): "VALID" | "EXPIRING_SOON" | "EXPIRED" {
  if (!expiresAt) return "VALID";
  const expiry = new Date(expiresAt);
  const ref = new Date(referenceDate);

  const refStartUtc = Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), ref.getUTCDate(), 0, 0, 0, 0);
  const expiryEndUtc = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate(), 23, 59, 59, 999);

  if (expiryEndUtc < refStartUtc) {
    return "EXPIRED";
  }

  const diffMs = expiry.getTime() - ref.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= warnDays) {
    return "EXPIRING_SOON";
  }

  return "VALID";
}

/**
 * Calculates aggregate holder counts for a given set of licences.
 */
export function calculateHolderCounts(
  licences: Array<LicenceLike & { user?: { id?: string; isActive: boolean } | null }>,
  options: { typeId?: string; onDate?: Date; includePending?: boolean } = {}
): {
  validHolders: number;
  expiringSoon: number;
  expired: number;
  pending: number;
} {
  const onDate = options.onDate || new Date();
  const validUserIds = new Set<string>();
  let expiringSoonCount = 0;
  let expiredCount = 0;
  let pendingCount = 0;

  for (const lic of licences) {
    if (options.typeId && lic.licenceTypeId !== options.typeId) continue;
    if (lic.archivedAt || lic.supersededById) continue;

    // Must be active user
    if (lic.user && !lic.user.isActive) continue;

    if (lic.status === "PENDING_VERIFICATION") {
      pendingCount++;
      if (options.includePending) {
        validUserIds.add(lic.userId);
      }
      continue;
    }

    if (lic.status === "EXPIRED") {
      expiredCount++;
      continue;
    }

    if (lic.status === "EXPIRING_SOON") {
      expiringSoonCount++;
      if (isLicenceValidOnDate(lic, onDate, options)) {
        validUserIds.add(lic.userId);
      }
      continue;
    }

    if (lic.status === "VALID") {
      if (isLicenceValidOnDate(lic, onDate, options)) {
        validUserIds.add(lic.userId);
      }
    }
  }

  return {
    validHolders: validUserIds.size,
    expiringSoon: expiringSoonCount,
    expired: expiredCount,
    pending: pendingCount,
  };
}
