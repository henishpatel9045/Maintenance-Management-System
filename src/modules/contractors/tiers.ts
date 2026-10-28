import { AuthenticatedUser, can } from "@/core/permissions/can";

export interface FieldTierContext {
  canReadFull: boolean;
  canViewCredentials: boolean;
  canViewDocuments: boolean;
  canViewRates: boolean;
}

export function getContractorTierContext(user: AuthenticatedUser | null | undefined): FieldTierContext {
  if (!user || !user.isActive) {
    return {
      canReadFull: false,
      canViewCredentials: false,
      canViewDocuments: false,
      canViewRates: false,
    };
  }

  const canReadFull = can(user, "contractors.readFull");
  const membersCanViewRates = Boolean(user.settings?.["membersCanViewContractorRates"] ?? false);
  const canViewRates = canReadFull || membersCanViewRates;
  const canViewCredentials = can(user, "contractors.credentials.view");
  const canViewDocuments = can(user, "contractors.documents.view");

  return {
    canReadFull,
    canViewCredentials,
    canViewDocuments,
    canViewRates,
  };
}

/**
 * Sanitizes a Contractor record, stripping restricted-tier fields based on user capabilities.
 */
export function sanitizeContractor<T extends Record<string, any>>(
  contractor: T,
  tierContext: FieldTierContext
): T {
  if (!contractor) return contractor;

  const copy: any = { ...contractor };

  // 1. Rates and Call-Out Fee: Requires canViewRates
  if (!tierContext.canViewRates) {
    delete copy.hourlyRate;
    delete copy.callOutFee;
  }

  // 2. Internal Notes: Requires canReadFull
  if (!tierContext.canReadFull) {
    delete copy.internalNotes;
  }

  // 3. Block Reason: Requires canReadFull
  if (!tierContext.canReadFull) {
    delete copy.blockedReason;
  }

  // 4. Financial totals / spend: Requires canReadFull
  if (!tierContext.canReadFull) {
    delete copy.totalSpend;
    delete copy.totalInvoiced;
    delete copy.totalQuoted;
  }

  // 5. Contacts: Name, role, phone, email are open tier. Notes require canReadFull.
  if (Array.isArray(copy.contacts)) {
    copy.contacts = copy.contacts.map((c: any) => {
      const contactCopy = { ...c };
      if (!tierContext.canReadFull) {
        delete contactCopy.notes;
      }
      return contactCopy;
    });
  }

  // 6. Credentials: Type and status badge are open tier. Number and exact dates require canViewCredentials.
  if (Array.isArray(copy.credentials)) {
    copy.credentials = copy.credentials.map((cred: any) => sanitizeCredential(cred, tierContext));
  }

  // 7. Reviews: Star rating and counts are open tier. Comment text requires canReadFull.
  if (Array.isArray(copy.reviews)) {
    copy.reviews = copy.reviews.map((rev: any) => sanitizeReview(rev, tierContext));
  }

  // 8. Seva Links (SevaContractor): Title, role, status are open tier. Amounts require canReadFull.
  if (Array.isArray(copy.sevas)) {
    copy.sevas = copy.sevas.map((sc: any) => sanitizeSevaContractor(sc, tierContext));
  }

  // 9. Documents / Files: All files require canViewDocuments
  if (Array.isArray(copy.documents) && !tierContext.canViewDocuments) {
    copy.documents = [];
  }
  if (Array.isArray(copy.files) && !tierContext.canViewDocuments) {
    copy.files = [];
  }

  return copy;
}

/**
 * Sanitizes a single Credential record.
 */
export function sanitizeCredential<T extends Record<string, any>>(
  credential: T,
  tierContext: FieldTierContext
): T {
  if (!credential) return credential;
  const copy = { ...credential };

  if (!tierContext.canViewCredentials) {
    delete copy.number;
    delete copy.issuer;
    delete copy.coverAmount;
    delete copy.issuedAt;
    delete copy.expiresAt;
    delete copy.verifiedAt;
    delete copy.verifiedById;
    delete copy.verifiedBy;
    delete copy.notes;
  }

  return copy;
}

/**
 * Sanitizes a Review record.
 */
export function sanitizeReview<T extends Record<string, any>>(
  review: T,
  tierContext: FieldTierContext
): T {
  if (!review) return review;
  const copy = { ...review };

  // Only users with contractors.readFull can see written comment text
  if (!tierContext.canReadFull) {
    delete copy.comment;
  }

  return copy;
}

/**
 * Sanitizes a SevaContractor association record.
 */
export function sanitizeSevaContractor<T extends Record<string, any>>(
  sc: T,
  tierContext: FieldTierContext
): T {
  if (!sc) return sc;
  const copy = { ...sc };

  if (!tierContext.canReadFull) {
    delete copy.quotedAmount;
    delete copy.finalAmount;
    delete copy.invoiceNumber;
    delete copy.invoicedAmount;
    delete copy.invoicedAt;
    delete copy.paidAt;
  }

  return copy;
}
