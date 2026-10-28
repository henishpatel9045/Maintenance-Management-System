import { describe, it, expect } from "vitest";
import {
  sanitizeUserLicence,
  sanitizeDirectoryPerson,
  maskLicenceNumber,
  LicenceTierContext,
} from "../../src/modules/licences/tiers";

describe("Licences Field-Tier Security & Server-Side Sanitization", () => {
  const directoryOnlyContext: LicenceTierContext = {
    userId: "viewer-1",
    canOwnView: false,
    canOwnSubmit: false,
    canDirectoryView: true,
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

  const contactContext: LicenceTierContext = {
    ...directoryOnlyContext,
    canDirectoryContact: true,
  };

  const sensitiveContext: LicenceTierContext = {
    ...directoryOnlyContext,
    canSensitiveView: true,
  };

  const documentsContext: LicenceTierContext = {
    ...directoryOnlyContext,
    canDocumentsView: true,
  };

  const fullAdminContext: LicenceTierContext = {
    userId: "admin-1",
    canOwnView: true,
    canOwnSubmit: true,
    canDirectoryView: true,
    canDirectoryContact: true,
    canManage: true,
    canVerify: true,
    canSensitiveView: true,
    canDocumentsView: true,
    canTypesManage: true,
    canSevaRequire: true,
    canReportsView: true,
    canImport: true,
  };

  const holderSelfContext: LicenceTierContext = {
    userId: "holder-1",
    canOwnView: true,
    canOwnSubmit: true,
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

  const rawStandardLicence = {
    id: "lic-std-1",
    userId: "holder-1",
    licenceTypeId: "type-forklift",
    class: "LF",
    licenceNumber: "NSW-889977482",
    issuer: "SafeWork NSW",
    issuedAt: new Date("2024-03-15T00:00:00Z"),
    expiresAt: new Date("2027-03-15T00:00:00Z"),
    conditions: "High visibility vest and steel cap boots mandatory",
    notes: "Internal staff note: verified original plastic card in person",
    status: "VALID",
    source: "ADMIN_ENTERED",
    verifiedById: "admin-1",
    verifiedAt: new Date("2024-03-15T10:00:00Z"),
    archivedAt: null,
    supersededById: null,
    version: 1,
    licenceType: {
      id: "type-forklift",
      name: "Forklift Licence",
      isHighlySensitive: false,
    },
    files: [
      {
        id: "fl-1",
        kind: "FRONT",
        fileObject: { id: "fo-1", originalName: "forklift_front.jpg" },
      },
    ],
  };

  const rawHighlySensitiveLicence = {
    ...rawStandardLicence,
    id: "lic-hs-1",
    licenceTypeId: "type-wwcc",
    licenceNumber: "WWC-0987654E",
    licenceType: {
      id: "type-wwcc",
      name: "Working with Children Check",
      isHighlySensitive: true,
    },
  };

  describe("Licence Number Masking", () => {
    it("masks numbers showing only the last 3 characters", () => {
      expect(maskLicenceNumber("NSW-889977482")).toBe("••••• 482");
      expect(maskLicenceNumber("12345678")).toBe("••••• 678");
    });

    it("handles short numbers gracefully", () => {
      expect(maskLicenceNumber("ABC")).toBe("••••• ABC");
      expect(maskLicenceNumber(null as any)).toBeNull();
    });
  });

  describe("Directory Tier (directory.view)", () => {
    it("strips licence number, exact dates, conditions, notes and files from directory view", () => {
      const sanitized = sanitizeUserLicence(rawStandardLicence, directoryOnlyContext);

      expect(sanitized.id).toBe("lic-std-1");
      expect(sanitized.class).toBe("LF");
      expect(sanitized.status).toBe("VALID");
      expect(sanitized.expiryMonth).toBe("Mar 2027");

      // Strictly absent
      expect(sanitized.licenceNumber).toBeUndefined();
      expect(sanitized.licenceNumberMasked).toBeUndefined();
      expect(sanitized.issuedAt).toBeUndefined();
      expect(sanitized.expiresAt).toBeUndefined();
      expect(sanitized.conditions).toBeUndefined();
      expect(sanitized.notes).toBeUndefined();
      expect(sanitized.files).toBeUndefined();
    });

    it("strips contact phone and email from directory person unless directory.contact is granted", () => {
      const rawPerson = {
        id: "holder-1",
        name: "Devotee One",
        email: "devotee@temple.local",
        phone: "0412 999 888",
        availability: { status: "AVAILABLE" },
        licences: [rawStandardLicence],
      };

      const dirOnly = sanitizeDirectoryPerson(rawPerson, directoryOnlyContext);
      expect(dirOnly.name).toBe("Devotee One");
      expect(dirOnly.email).toBeUndefined();
      expect(dirOnly.phone).toBeUndefined();

      const withContact = sanitizeDirectoryPerson(rawPerson, contactContext);
      expect(withContact.name).toBe("Devotee One");
      expect(withContact.email).toBe("devotee@temple.local");
      expect(withContact.phone).toBe("0412 999 888");
    });
  });

  describe("Sensitive Tier (sensitive.view)", () => {
    it("returns masked licence number and exact dates but NO files", () => {
      const sanitized = sanitizeUserLicence(rawStandardLicence, sensitiveContext);

      expect(sanitized.licenceNumberMasked).toBe("••••• 482");
      expect(sanitized.licenceNumber).toBeUndefined(); // raw number unmasked only via reveal endpoint
      expect(sanitized.issuedAt).toBeDefined();
      expect(sanitized.expiresAt).toBeDefined();
      expect(sanitized.conditions).toBe("High visibility vest and steel cap boots mandatory");
      expect(sanitized.files).toBeUndefined();
    });
  });

  describe("Documents Tier (documents.view)", () => {
    it("allows files access when documents.view is granted", () => {
      const sanitized = sanitizeUserLicence(rawStandardLicence, documentsContext);
      expect(sanitized.files).toHaveLength(1);
      expect(sanitized.files![0].id).toBe("fl-1");
      // But sensitive fields remain stripped
      expect(sanitized.licenceNumberMasked).toBeUndefined();
      expect(sanitized.conditions).toBeUndefined();
    });
  });

  describe("Licence Holder Own View", () => {
    it("holder sees full unmasked number, conditions, exact dates and files for their own licence", () => {
      const sanitized = sanitizeUserLicence(rawStandardLicence, holderSelfContext);

      expect(sanitized.licenceNumber).toBe("NSW-889977482");
      expect(sanitized.licenceNumberMasked).toBe("NSW-889977482");
      expect(sanitized.issuedAt).toBeDefined();
      expect(sanitized.expiresAt).toBeDefined();
      expect(sanitized.conditions).toBe("High visibility vest and steel cap boots mandatory");
      expect(sanitized.files).toHaveLength(1);
    });

    it("holder cannot view another user's licence details", () => {
      const anotherUserContext: LicenceTierContext = {
        ...holderSelfContext,
        userId: "other-user-99",
      };
      const sanitized = sanitizeUserLicence(rawStandardLicence, anotherUserContext);

      expect(sanitized.licenceNumber).toBeUndefined();
      expect(sanitized.licenceNumberMasked).toBeUndefined();
      expect(sanitized.files).toBeUndefined();
    });
  });

  describe("Highly Sensitive Types (Police Check, WWCC, Driver Licence)", () => {
    it("hides number and files even from sensitive.view alone or documents.view alone", () => {
      const sensOnly = sanitizeUserLicence(rawHighlySensitiveLicence, sensitiveContext);
      expect(sensOnly.licenceNumberMasked).toBeUndefined();
      expect(sensOnly.files).toBeUndefined();

      const docOnly = sanitizeUserLicence(rawHighlySensitiveLicence, documentsContext);
      expect(docOnly.licenceNumberMasked).toBeUndefined();
      expect(docOnly.files).toBeUndefined();
    });

    it("reveals highly sensitive details ONLY to holder OR user holding BOTH sensitive.view AND documents.view", () => {
      // Both granted (admin)
      const bothGranted = sanitizeUserLicence(rawHighlySensitiveLicence, fullAdminContext);
      expect(bothGranted.licenceNumberMasked).toBe("••••• 54E");
      expect(bothGranted.files).toHaveLength(1);

      // Holder self
      const holderView = sanitizeUserLicence(rawHighlySensitiveLicence, holderSelfContext);
      expect(holderView.licenceNumber).toBe("WWC-0987654E");
      expect(holderView.files).toHaveLength(1);
    });
  });
});
