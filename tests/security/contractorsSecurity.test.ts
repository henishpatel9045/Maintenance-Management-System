import { describe, it, expect } from "vitest";
import { can, AuthenticatedUser } from "../../src/core/permissions/can";
import { PermissionKey } from "../../src/core/permissions/keys";
import {
  createContractorSchema,
  updateContractorSchema,
  createContractorRequestSchema,
} from "../../src/modules/contractors/schemas";

describe("Security Suite: Contractors Authorization Matrix & Threat Model", () => {
  const CONTRACTOR_PERMISSION_KEYS: PermissionKey[] = [
    "contractors.read",
    "contractors.readFull",
    "contractors.request",
    "contractors.requests.review",
    "contractors.write",
    "contractors.credentials.view",
    "contractors.credentials.manage",
    "contractors.documents.view",
    "contractors.documents.manage",
    "contractors.reviews.write",
    "contractors.assign",
    "contractors.import",
    "contractors.manage",
  ];

  const anonymousUser = null;

  const deactivatedUser: AuthenticatedUser = {
    id: "deactivated-user-id",
    name: "Deactivated User",
    email: "deactivated@seva.local",
    role: "MEMBER",
    isActive: false,
    permissions: new Set(CONTRACTOR_PERMISSION_KEYS),
  };

  const memberUser: AuthenticatedUser = {
    id: "member-user-id",
    name: "Regular Member",
    email: "member@seva.local",
    role: "MEMBER",
    isActive: true,
    permissions: new Set(["contractors.read", "contractors.request"]),
  };

  const coordinatorUser: AuthenticatedUser = {
    id: "coordinator-user-id",
    name: "Maintenance Coordinator",
    email: "coordinator@seva.local",
    role: "COORDINATOR",
    isActive: true,
    permissions: new Set(
      CONTRACTOR_PERMISSION_KEYS.filter(
        (k) => k !== "contractors.import" && k !== "contractors.manage"
      )
    ),
  };

  const adminUser: AuthenticatedUser = {
    id: "admin-user-id",
    name: "System Admin",
    email: "admin@seva.local",
    role: "ADMIN",
    isActive: true,
    permissions: new Set(CONTRACTOR_PERMISSION_KEYS),
  };

  describe("Authorization Matrix", () => {
    it("denies all contractor endpoints to anonymous callers", () => {
      for (const perm of CONTRACTOR_PERMISSION_KEYS) {
        expect(can(anonymousUser, perm)).toBe(false);
      }
    });

    it("denies all contractor endpoints to deactivated users", () => {
      for (const perm of CONTRACTOR_PERMISSION_KEYS) {
        expect(can(deactivatedUser, perm)).toBe(false);
      }
    });

    it("grants members ONLY contractors.read and contractors.request", () => {
      expect(can(memberUser, "contractors.read")).toBe(true);
      expect(can(memberUser, "contractors.request")).toBe(true);

      // Must be denied all write, review, import, and management capabilities
      expect(can(memberUser, "contractors.write")).toBe(false);
      expect(can(memberUser, "contractors.requests.review")).toBe(false);
      expect(can(memberUser, "contractors.readFull")).toBe(false);
      expect(can(memberUser, "contractors.credentials.view")).toBe(false);
      expect(can(memberUser, "contractors.credentials.manage")).toBe(false);
      expect(can(memberUser, "contractors.documents.view")).toBe(false);
      expect(can(memberUser, "contractors.documents.manage")).toBe(false);
      expect(can(memberUser, "contractors.reviews.write")).toBe(false);
      expect(can(memberUser, "contractors.assign")).toBe(false);
      expect(can(memberUser, "contractors.import")).toBe(false);
      expect(can(memberUser, "contractors.manage")).toBe(false);
    });

    it("grants coordinators all operational keys except import and manage", () => {
      expect(can(coordinatorUser, "contractors.read")).toBe(true);
      expect(can(coordinatorUser, "contractors.readFull")).toBe(true);
      expect(can(coordinatorUser, "contractors.write")).toBe(true);
      expect(can(coordinatorUser, "contractors.requests.review")).toBe(true);
      expect(can(coordinatorUser, "contractors.credentials.manage")).toBe(true);
      expect(can(coordinatorUser, "contractors.documents.manage")).toBe(true);
      expect(can(coordinatorUser, "contractors.reviews.write")).toBe(true);
      expect(can(coordinatorUser, "contractors.assign")).toBe(true);

      // Restricted from admin-only manage and bulk import
      expect(can(coordinatorUser, "contractors.import")).toBe(false);
      expect(can(coordinatorUser, "contractors.manage")).toBe(false);
    });

    it("grants admins all contractor capabilities", () => {
      for (const perm of CONTRACTOR_PERMISSION_KEYS) {
        expect(can(adminUser, perm)).toBe(true);
      }
    });
  });

  describe("Input Sanitization & Schema Defense", () => {
    it("rejects mass assignment and extra fields using strict Zod schemas", () => {
      const maliciousPayload = {
        companyName: "Legit Company",
        role: "ADMIN", // Injection attempt
        isAdmin: true, // Injection attempt
        bypassPermissions: true, // Injection attempt
      };

      const result = createContractorSchema.safeParse(maliciousPayload);
      expect(result.success).toBe(false);
    });

    it("rejects credit card numbers in free text fields (Luhn defense)", () => {
      const cardPayload = {
        companyName: "Acme Power Pty Ltd",
        internalNotes: "Charge payment card 4532 0150 0000 0007 for call-out fee",
      };

      const result = createContractorSchema.safeParse(cardPayload);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain("Potential payment card number detected");
      }
    });

    it("enforces strict maximum character limits on proposal notes (DoS defense)", () => {
      const longNote = "A".repeat(2001); // Exceeds 2000 max
      const payload = {
        type: "NEW_CONTRACTOR" as const,
        note: longNote,
        proposedData: {
          companyName: "Valid Business",
        },
      };

      const result = createContractorRequestSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it("safely accepts SQL injection and XSS payloads without erroring or interpreting", () => {
      const attackPayload = {
        companyName: "Apex <script>alert(1)</script> Roofing",
        tradingName: "Roofers ' OR '1'='1' --",
        suburb: "'; DROP TABLE contractors;--",
        tradeIds: ["11111111-1111-1111-1111-111111111111"],
      };

      const result = createContractorSchema.safeParse(attackPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        // Values are kept as safe literal strings
        expect(result.data.companyName).toBe("Apex <script>alert(1)</script> Roofing");
        expect(result.data.tradingName).toBe("Roofers ' OR '1'='1' --");
      }
    });
  });
});
