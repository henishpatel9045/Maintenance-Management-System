import { AuthenticatedUser, can } from "@/core/permissions/can";

export interface LicenceTierContext {
  userId: string;
  canOwnView: boolean;
  canOwnSubmit: boolean;
  canDirectoryView: boolean;
  canDirectoryContact: boolean;
  canManage: boolean;
  canVerify: boolean;
  canSensitiveView: boolean;
  canDocumentsView: boolean;
  canTypesManage: boolean;
  canSevaRequire: boolean;
  canReportsView: boolean;
  canImport: boolean;
}

export function getLicenceTierContext(user: AuthenticatedUser | null | undefined): LicenceTierContext {
  if (!user || !user.isActive) {
    return {
      userId: "",
      canOwnView: false,
      canOwnSubmit: false,
      canDirectoryView: false,
      canDirectoryContact: false,
      canManage: false,
      canVerify: false,
      canSensitiveView: false,
      canDocumentsView: false,
      canTypesManage: false,
      canSevaRequire: false,
      canReportsView: false,
      canImport: false,
    };
  }

  return {
    userId: user.id,
    canOwnView: can(user, "licences.own.view"),
    canOwnSubmit: can(user, "licences.own.submit"),
    canDirectoryView: can(user, "licences.directory.view"),
    canDirectoryContact: can(user, "licences.directory.contact"),
    canManage: can(user, "licences.manage"),
    canVerify: can(user, "licences.verify"),
    canSensitiveView: can(user, "licences.sensitive.view"),
    canDocumentsView: can(user, "licences.documents.view"),
    canTypesManage: can(user, "licences.types.manage"),
    canSevaRequire: can(user, "licences.seva.require"),
    canReportsView: can(user, "licences.reports.view"),
    canImport: can(user, "licences.import"),
  };
}

/**
 * Masks a licence number with bullet dots, revealing only the last 3 or 4 characters.
 * Example: "LF-SA-882194" -> "••••• 194"
 */
export function maskLicenceNumber(number: string | null | undefined): string | null {
  if (!number) return null;
  const str = number.trim();
  if (str.length <= 3) {
    return `••••• ${str}`;
  }
  const suffix = str.slice(-3);
  return `••••• ${suffix}`;
}

/**
 * Formats a date to Month and Year only (e.g., "Nov 2026") for directory tier.
 */
export function formatExpiryMonthYear(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Sanitizes a UserLicence record according to the caller's capability tier and ownership.
 * Never raises errors for absent fields; forbidden fields are omitted completely.
 */
export function sanitizeUserLicence<T extends Record<string, any>>(
  licence: T,
  tier: LicenceTierContext,
  options: { isRevealed?: boolean } = {}
): Partial<T> & {
  licenceNumberMasked?: string;
  maskedLicenceNumber?: string;
  expiryMonth?: string | null;
  expiryMonthYear?: string | null;
  isOwn?: boolean;
  isMasked?: boolean;
  files?: any[];
  [key: string]: any;
} {
  if (!licence) return licence;

  const isOwn = Boolean(tier.userId && licence.userId === tier.userId);
  const isHighlySensitive = Boolean(licence.licenceType?.isHighlySensitive);

  // 1. Licence Holder (own.view) always sees all fields of their own licences
  if (isOwn && tier.canOwnView) {
    return {
      ...licence,
      licenceNumberMasked: licence.licenceNumber,
      isOwn: true,
      isMasked: false,
    };
  }

  // 2. Non-owner caller: must have directory.view, manage, verify, or sensitive.view
  const hasAnyDirectoryAccess =
    tier.canDirectoryView || tier.canManage || tier.canVerify || tier.canSensitiveView;

  if (!hasAnyDirectoryAccess) {
    // Return empty object if caller has no licence viewing capability for other users
    return {} as Partial<T>;
  }

  // Deep clone to safely delete fields
  const copy: any = { ...licence, isOwn: false };

  // Determine sensitive permission for this type:
  // For highly sensitive types (driver licence, WWCC, police check), requires BOTH sensitive.view AND documents.view
  const hasSensitiveAccess = isHighlySensitive
    ? tier.canSensitiveView && tier.canDocumentsView
    : tier.canSensitiveView || tier.canManage;

  const hasDocumentsAccess = isHighlySensitive
    ? tier.canSensitiveView && tier.canDocumentsView
    : tier.canDocumentsView || tier.canManage;

  // 3. User info contact tier check
  if (copy.user) {
    const userCopy = { ...copy.user };
    if (!tier.canDirectoryContact && !tier.canManage) {
      delete userCopy.email;
      delete userCopy.phone;
    }
    copy.user = userCopy;
  }

  // 4. Highly sensitive types in directory tier: show ONLY the status badge, class, type info
  if (isHighlySensitive && !hasSensitiveAccess) {
    delete copy.licenceNumber;
    delete copy.issuedAt;
    delete copy.expiresAt;
    delete copy.conditions;
    delete copy.notes;
    delete copy.verifiedById;
    delete copy.verifiedAt;
    delete copy.rejectionReason;
    delete copy.files;
    delete copy.fileLinks;
    copy.expiryMonthYear = null; // hidden for highly sensitive
    copy.isMasked = true;
    return copy;
  }

  // 5. Sensitive fields (number, exact dates, conditions, notes)
  if (hasSensitiveAccess) {
    // Numbers are masked by default everywhere even for permitted viewers until Reveal
    const masked = maskLicenceNumber(copy.licenceNumber);
    copy.maskedLicenceNumber = masked;
    copy.licenceNumberMasked = masked;

    if (options.isRevealed) {
      copy.isMasked = false;
      // keep copy.licenceNumber intact
    } else {
      delete copy.licenceNumber;
      copy.isMasked = true;
    }
  } else {
    // Directory tier: no licence number, no exact issue date, no conditions, no internal notes
    delete copy.licenceNumber;
    delete copy.maskedLicenceNumber;
    delete copy.licenceNumberMasked;
    delete copy.issuedAt;
    delete copy.conditions;
    delete copy.notes;
    delete copy.rejectionReason;
    delete copy.verifiedById;
    delete copy.verifiedAt;

    // Convert exact expiry date to month/year only
    const monthYear = formatExpiryMonthYear(copy.expiresAt);
    copy.expiryMonthYear = monthYear;
    copy.expiryMonth = monthYear;
    delete copy.expiresAt;
  }

  // 6. Documents tier
  if (!hasDocumentsAccess) {
    delete copy.files;
    delete copy.fileLinks;
  }

  return copy;
}

/**
 * Sanitizes a person record (user + licences) for the directory view.
 */
export function sanitizeDirectoryPerson<T extends Record<string, any>>(
  person: T,
  tier: LicenceTierContext
): Partial<T> {
  if (!person) return person;
  const copy: any = { ...person };

  if (!tier.canDirectoryContact && !tier.canManage) {
    delete copy.email;
    delete copy.phone;
  }

  if (copy.licences && Array.isArray(copy.licences)) {
    copy.licences = copy.licences.map((l: any) => sanitizeUserLicence(l, tier));
  }

  return copy;
}
