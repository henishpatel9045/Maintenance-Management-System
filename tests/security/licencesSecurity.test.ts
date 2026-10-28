import { describe, it, expect } from "vitest";
import { can, AuthenticatedUser } from "../../src/core/permissions/can";
import { PermissionKey } from "../../src/core/permissions/keys";
import {
  selfSubmitLicenceSchema,
  createLicenceAdminSchema,
  updateLicenceSchema,
  verifyLicenceSchema,
} from "../../src/modules/licences/schemas";
import { safeFormulaCell } from "../../src/modules/licences/reports.service";

describe("Security Suite: Licences Authorization Matrix & Threat Model", () => {
  const LICENCE_PERMISSION_KEYS: PermissionKey[] = [
    "licences.own.view",
    "licences.own.submit",
    "licences.directory.view",
    "licences.directory.contact",
    "licences.manage",
    "licences.verify",
    "licences.sensitive.view",
    "licences.documents.view",
    "licences.types.manage",
    "licences.seva.require",
    "licences.reports.view",
    "licences.import",
  ];

  const anonymousUser = null;

  const deactivatedUser: AuthenticatedUser = {
    id: "deactivated-user-id",
    name: "Deactivated Member",
    email: "deactivated@seva.local",
    role: "MEMBER",
    isActive: false,
    permissions: new Set(LICENCE_PERMISSION_KEYS),
  };

  const memberUser: AuthenticatedUser = {
    id: "member-user-id",
    name: "Regular Volunteer Member",
    email: "volunteer@seva.local",
    role: "MEMBER",
    isActive: true,
    permissions: new Set(["licences.own.view", "licences.own.submit"]),
  };

  const coordinatorUser: AuthenticatedUser = {
    id: "coordinator-user-id",
    name: "Maintenance Coordinator",
    email: "coordinator@seva.local",
    role: "COORDINATOR",
    isActive: true,
    permissions: new Set([
      "licences.own.view",
      "licences.own.submit",
      "licences.directory.view",
      "licences.directory.contact",
      "licences.seva.require",
      "licences.reports.view",
    ]),
  };

  const adminUser: AuthenticatedUser = {
    id: "admin-user-id",
    name: "System Administrator",
    email: "admin@seva.local",
    role: "ADMIN",
    isActive: true,
    permissions: new Set(LICENCE_PERMISSION_KEYS),
  };

  describe("1. Authorization Matrix", () => {
    it("denies all licence endpoints to anonymous callers", () => {
      for (const perm of LICENCE_PERMISSION_KEYS) {
        expect(can(anonymousUser, perm)).toBe(false);
      }
    });

    it("denies all licence endpoints to deactivated accounts", () => {
      for (const perm of LICENCE_PERMISSION_KEYS) {
        expect(can(deactivatedUser, perm)).toBe(false);
      }
    });

    it("grants standard members ONLY licences.own.view and licences.own.submit", () => {
      expect(can(memberUser, "licences.own.view")).toBe(true);
      expect(can(memberUser, "licences.own.submit")).toBe(true);

      // Denied directory, verification, sensitive numbers, types, reports, import
      expect(can(memberUser, "licences.directory.view")).toBe(false);
      expect(can(memberUser, "licences.directory.contact")).toBe(false);
      expect(can(memberUser, "licences.manage")).toBe(false);
      expect(can(memberUser, "licences.verify")).toBe(false);
      expect(can(memberUser, "licences.sensitive.view")).toBe(false);
      expect(can(memberUser, "licences.documents.view")).toBe(false);
      expect(can(memberUser, "licences.types.manage")).toBe(false);
      expect(can(memberUser, "licences.seva.require")).toBe(false);
      expect(can(memberUser, "licences.reports.view")).toBe(false);
      expect(can(memberUser, "licences.import")).toBe(false);
    });

    it("grants coordinators directory, contact, seva requirements, and reports", () => {
      expect(can(coordinatorUser, "licences.own.view")).toBe(true);
      expect(can(coordinatorUser, "licences.own.submit")).toBe(true);
      expect(can(coordinatorUser, "licences.directory.view")).toBe(true);
      expect(can(coordinatorUser, "licences.directory.contact")).toBe(true);
      expect(can(coordinatorUser, "licences.seva.require")).toBe(true);
      expect(can(coordinatorUser, "licences.reports.view")).toBe(true);

      // Coordinators by default do NOT see sensitive unmasked numbers, documents, verification, or manage
      expect(can(coordinatorUser, "licences.manage")).toBe(false);
      expect(can(coordinatorUser, "licences.verify")).toBe(false);
      expect(can(coordinatorUser, "licences.sensitive.view")).toBe(false);
      expect(can(coordinatorUser, "licences.documents.view")).toBe(false);
      expect(can(coordinatorUser, "licences.types.manage")).toBe(false);
      expect(can(coordinatorUser, "licences.import")).toBe(false);
    });

    it("grants admins all 12 licence permissions", () => {
      for (const perm of LICENCE_PERMISSION_KEYS) {
        expect(can(adminUser, perm)).toBe(true);
      }
    });
  });

  describe("2. Self-Service Mass Assignment Defenses", () => {
    it("rejects attempt by member to set status to VALID in self-submission", () => {
      const maliciousSubmission = {
        licenceTypeId: "11111111-1111-1111-1111-111111111111",
        licenceNumber: "LF-998877",
        status: "VALID", // Mass assignment attempt!
      };

      const result = selfSubmitLicenceSchema.safeParse(maliciousSubmission);
      expect(result.success).toBe(false);
    });

    it("rejects attempt by member to set verifiedById, source, or userId", () => {
      const attackPayload = {
        licenceTypeId: "11111111-1111-1111-1111-111111111111",
        verifiedById: "admin-id",
        source: "ADMIN_ENTERED",
        userId: "other-user-id",
      };

      const result = selfSubmitLicenceSchema.safeParse(attackPayload);
      expect(result.success).toBe(false);
    });

    it("accepts only valid self-submitted fields", () => {
      const validSubmission = {
        licenceTypeId: "11111111-1111-1111-1111-111111111111",
        class: "LF",
        licenceNumber: "NSW-889900",
        issuer: "SafeWork NSW",
        issuedAt: "2024-01-01",
        expiresAt: "2027-01-01",
        conditions: "Restricted to warehouse",
        notes: "Uploaded new photo card",
      };

      const result = selfSubmitLicenceSchema.safeParse(validSubmission);
      expect(result.success).toBe(true);
    });
  });

  describe("3. Formula Injection Neutralization in Exports", () => {
    it("neutralizes cells beginning with dangerous spreadsheet formula triggers", () => {
      const dangerousTriggers = [
        "=SUM(A1:A10)",
        "+1+1",
        "-5+10",
        "@SUM(1,2)",
        "\tEXEC('calc.exe')",
        "\rCMD|' /C calc'!A0",
      ];

      for (const trigger of dangerousTriggers) {
        const safe = safeFormulaCell(trigger);
        expect(safe.startsWith("'")).toBe(true);
      }
    });

    it("does not alter safe normal text cells", () => {
      expect(safeFormulaCell("Forklift LF")).toBe("Forklift LF");
      expect(safeFormulaCell("John Smith")).toBe("John Smith");
      expect(safeFormulaCell("Dec 2026")).toBe("Dec 2026");
      expect(safeFormulaCell(null)).toBeNull();
      expect(safeFormulaCell(undefined)).toBeUndefined();
    });
  });

  describe("4. Luhn Payment Card Detection & DoS Length Defenses", () => {
    it("rejects payment card numbers embedded in conditions or notes", () => {
      const cardPayload = {
        class: "LF",
        notes: "Card for licence renewal fee: 4532 0150 0000 0007",
      };

      const result = updateLicenceSchema.safeParse(cardPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Potential payment card number detected");
      }
    });

    it("rejects oversized notes and conditions to prevent denial of service", () => {
      const oversized = "A".repeat(2001);
      const payload = {
        notes: oversized,
      };

      const result = updateLicenceSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe("5. SQL Injection & XSS Payload Containment", () => {
    it("stores attack vectors safely as literal strings without executing", () => {
      const xssAndSqlPayload = {
        licenceTypeId: "11111111-1111-1111-1111-111111111111",
        class: "'; DROP TABLE \"user_licences\"; --",
        licenceNumber: "<script>alert('XSS')</script>",
        issuer: "SafeWork <img src=x onerror=alert(1)>",
        conditions: "' OR '1'='1",
      };

      const result = selfSubmitLicenceSchema.safeParse(xssAndSqlPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.class).toBe("'; DROP TABLE \"user_licences\"; --");
        expect(result.data.licenceNumber).toBe("<script>alert('XSS')</script>");
        expect(result.data.issuer).toBe("SafeWork <img src=x onerror=alert(1)>");
      }
    });
  });

  describe("6. Optimistic Concurrency Defense", () => {
    it("requires expectedVersion for verification", () => {
      const validVerify = {
        status: "VALID" as const,
        expectedVersion: 2,
      };
      const result = verifyLicenceSchema.safeParse(validVerify);
      expect(result.success).toBe(true);

      const missingVersion = {
        status: "VALID" as const,
      };
      const badResult = verifyLicenceSchema.safeParse(missingVersion);
      expect(badResult.success).toBe(false);
    });
  });
});
