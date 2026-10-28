import { describe, it, expect } from "vitest";
import {
  sanitizeContractor,
  sanitizeCredential,
  sanitizeReview,
  sanitizeSevaContractor,
  FieldTierContext,
} from "../../src/modules/contractors/tiers";

describe("Contractors Field-Tier Security & Server-Side Stripping", () => {
  const memberContext: FieldTierContext = {
    canReadFull: false,
    canViewCredentials: false,
    canViewDocuments: false,
    canViewRates: false,
  };

  const coordinatorContext: FieldTierContext = {
    canReadFull: true,
    canViewCredentials: true,
    canViewDocuments: true,
    canViewRates: true,
  };

  const rawContractor = {
    id: "con-123",
    code: "CON-0001",
    companyName: "Acme Electrical Services",
    tradingName: "Acme Power",
    registrationNumber: "51824753556",
    registrationType: "ABN",
    gstRegistered: true,
    status: "BLOCKED",
    blockedReason: "Failed safety audit on site 4",
    isPreferred: false,
    website: "https://acme.local",
    mainPhone: "0412 345 678",
    mainEmail: "info@acme.local",
    emergencyPhone: "0400 999 888",
    paymentTerms: "Net 14",
    callOutFee: 150.0,
    hourlyRate: 110.0,
    currency: "AUD",
    internalNotes: "Private negotiation notes: rates can be discounted by 10% on large jobs.",
    archivedAt: null,
  };

  const rawCredential = {
    id: "cred-456",
    contractorId: "con-123",
    kind: "INSURANCE",
    type: "Public & Products Liability",
    issuer: "QBE Insurance Group",
    number: "POL-9988776655",
    coverAmount: 20000000.0,
    issuedAt: new Date("2025-01-01"),
    expiresAt: new Date("2026-12-31"),
    status: "VALID",
    verifiedById: "user-coord-1",
    verifiedAt: new Date("2025-01-05"),
    notes: "Certificate of currency sighted and verified on register.",
  };

  const rawReview = {
    id: "rev-789",
    contractorId: "con-123",
    rating: 4,
    qualityRating: 5,
    timelinessRating: 4,
    priceRating: 3,
    wouldUseAgain: true,
    comment: "Excellent technical work, but invoices were slightly higher than initial estimate.",
    reviewedById: "user-coord-1",
    createdAt: new Date("2025-06-01"),
  };

  const rawSevaContractor = {
    id: "sc-111",
    sevaId: "seva-1",
    contractorId: "con-123",
    role: "PRIMARY",
    scope: "Full electrical rewire",
    status: "COMPLETED",
    quotedAmount: 12500.0,
    finalAmount: 13000.0,
    invoiceNumber: "INV-2025-044",
    invoicedAmount: 13000.0,
    engagedAt: new Date("2025-03-01"),
    completedAt: new Date("2025-03-15"),
  };

  describe("Contractor Profile Sanitization", () => {
    it("strips commercial rates, internal notes, and block reason for Members", () => {
      const sanitized = sanitizeContractor(rawContractor, memberContext);

      // Open tier fields must be present
      expect(sanitized.id).toBe("con-123");
      expect(sanitized.code).toBe("CON-0001");
      expect(sanitized.companyName).toBe("Acme Electrical Services");
      expect(sanitized.status).toBe("BLOCKED"); // Clear status badge
      expect(sanitized.mainPhone).toBe("0412 345 678");

      // Restricted tier fields must be absent (undefined)
      expect(sanitized.callOutFee).toBeUndefined();
      expect(sanitized.hourlyRate).toBeUndefined();
      expect(sanitized.internalNotes).toBeUndefined();
      expect(sanitized.blockedReason).toBeUndefined();
    });

    it("retains all commercial rates, internal notes, and block reason for Coordinators and Admins", () => {
      const sanitized = sanitizeContractor(rawContractor, coordinatorContext);

      expect(sanitized.callOutFee).toBe(150.0);
      expect(sanitized.hourlyRate).toBe(110.0);
      expect(sanitized.internalNotes).toBe("Private negotiation notes: rates can be discounted by 10% on large jobs.");
      expect(sanitized.blockedReason).toBe("Failed safety audit on site 4");
    });

    it("reveals rates to members only when canViewRates is enabled", () => {
      const ratesOpenContext: FieldTierContext = {
        canReadFull: false,
        canViewCredentials: false,
        canViewDocuments: false,
        canViewRates: true,
      };

      const sanitized = sanitizeContractor(rawContractor, ratesOpenContext);
      expect(sanitized.callOutFee).toBe(150.0);
      expect(sanitized.hourlyRate).toBe(110.0);

      // Internal notes and block reason must still remain strictly hidden!
      expect(sanitized.internalNotes).toBeUndefined();
      expect(sanitized.blockedReason).toBeUndefined();
    });
  });

  describe("Credential Sanitization", () => {
    it("hides policy numbers, cover amounts, exact dates, and verifiers from Members", () => {
      const sanitized = sanitizeCredential(rawCredential, memberContext);

      // Open badge indicators remain visible
      expect(sanitized.id).toBe("cred-456");
      expect(sanitized.kind).toBe("INSURANCE");
      expect(sanitized.type).toBe("Public & Products Liability");
      expect(sanitized.status).toBe("VALID");

      // Sensitive fields must be completely stripped
      expect(sanitized.number).toBeUndefined();
      expect(sanitized.coverAmount).toBeUndefined();
      expect(sanitized.issuer).toBeUndefined();
      expect(sanitized.issuedAt).toBeUndefined();
      expect(sanitized.expiresAt).toBeUndefined();
      expect(sanitized.verifiedById).toBeUndefined();
      expect(sanitized.verifiedAt).toBeUndefined();
      expect(sanitized.notes).toBeUndefined();
    });

    it("preserves policy details and exact expiry dates for permitted compliance users", () => {
      const sanitized = sanitizeCredential(rawCredential, coordinatorContext);

      expect(sanitized.number).toBe("POL-9988776655");
      expect(sanitized.coverAmount).toBe(20000000.0);
      expect(sanitized.issuer).toBe("QBE Insurance Group");
      expect(sanitized.status).toBe("VALID");
      expect(sanitized.expiresAt).toEqual(new Date("2026-12-31"));
    });
  });

  describe("Review Sanitization", () => {
    it("strips coordinator written commentary for Members, keeping star ratings", () => {
      const sanitized = sanitizeReview(rawReview, memberContext);

      expect(sanitized.id).toBe("rev-789");
      expect(sanitized.rating).toBe(4);
      expect(sanitized.qualityRating).toBe(5);
      expect(sanitized.timelinessRating).toBe(4);
      expect(sanitized.priceRating).toBe(3);
      expect(sanitized.wouldUseAgain).toBe(true);

      // Commentary must be stripped
      expect(sanitized.comment).toBeUndefined();
    });

    it("retains full review comments for Coordinators and Admins", () => {
      const sanitized = sanitizeReview(rawReview, coordinatorContext);

      expect(sanitized.comment).toBe("Excellent technical work, but invoices were slightly higher than initial estimate.");
    });
  });

  describe("Seva Contractor Job Sanitization", () => {
    it("strips quoted, final, and invoiced amounts from Members", () => {
      const sanitized = sanitizeSevaContractor(rawSevaContractor, memberContext);

      expect(sanitized.role).toBe("PRIMARY");
      expect(sanitized.scope).toBe("Full electrical rewire");
      expect(sanitized.status).toBe("COMPLETED");

      // Financials stripped
      expect(sanitized.quotedAmount).toBeUndefined();
      expect(sanitized.finalAmount).toBeUndefined();
      expect(sanitized.invoiceNumber).toBeUndefined();
      expect(sanitized.invoicedAmount).toBeUndefined();
    });

    it("retains all financial details for Coordinators and Admins", () => {
      const sanitized = sanitizeSevaContractor(rawSevaContractor, coordinatorContext);

      expect(sanitized.quotedAmount).toBe(12500.0);
      expect(sanitized.finalAmount).toBe(13000.0);
      expect(sanitized.invoiceNumber).toBe("INV-2025-044");
      expect(sanitized.invoicedAmount).toBe(13000.0);
    });
  });
});
