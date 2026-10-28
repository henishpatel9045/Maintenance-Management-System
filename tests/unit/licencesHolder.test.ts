import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  isLicenceValidOnDate,
  isUserValidHolder,
  deriveUserLicenceStatus,
  calculateHolderCounts,
} from "../../src/modules/licences/holder";

describe("Licences Holder Domain Logic & Property-Based Tests", () => {
  const baseLicence = {
    id: "lic-1",
    userId: "user-1",
    licenceTypeId: "type-forklift",
    class: "LF",
    status: "VALID",
    verifiedAt: new Date("2026-01-01"),
    archivedAt: null,
    supersededById: null,
    expiresAt: new Date("2026-12-31"),
  };

  const activeUser = {
    id: "user-1",
    name: "John Holder",
    isActive: true,
  };

  describe("Canonical Holder Definition", () => {
    it("recognizes an active user with verified VALID licence as a holder", () => {
      expect(isUserValidHolder(activeUser, baseLicence)).toBe(true);
    });

    it("recognizes an active user with verified EXPIRING_SOON licence as a holder", () => {
      const expiringLicence = { ...baseLicence, status: "EXPIRING_SOON" };
      expect(isUserValidHolder(activeUser, expiringLicence)).toBe(true);
    });

    it("rejects an inactive (deactivated) user even if licence is VALID", () => {
      const inactiveUser = { ...activeUser, isActive: false };
      expect(isUserValidHolder(inactiveUser, baseLicence)).toBe(false);
    });

    it("rejects unverified PENDING_VERIFICATION licence by default", () => {
      const pendingLicence = {
        ...baseLicence,
        status: "PENDING_VERIFICATION",
        verifiedAt: null,
      };
      expect(isUserValidHolder(activeUser, pendingLicence)).toBe(false);
      // But counts when includePending is enabled
      expect(isUserValidHolder(activeUser, pendingLicence, { includePending: true })).toBe(true);
    });

    it("rejects EXPIRED, SUSPENDED, REVOKED, and REJECTED licences", () => {
      const statuses = ["EXPIRED", "SUSPENDED", "REVOKED", "REJECTED"];
      for (const st of statuses) {
        const l = { ...baseLicence, status: st };
        expect(isUserValidHolder(activeUser, l)).toBe(false);
      }
    });

    it("rejects archived and superseded licences", () => {
      const archived = { ...baseLicence, archivedAt: new Date() };
      expect(isUserValidHolder(activeUser, archived)).toBe(false);

      const superseded = { ...baseLicence, supersededById: "lic-2" };
      expect(isUserValidHolder(activeUser, superseded)).toBe(false);
    });
  });

  describe("Date D Validity Rule", () => {
    const dec31_2026 = new Date("2026-12-31T23:59:59Z");
    const lic = { ...baseLicence, expiresAt: dec31_2026 };

    it("is valid on a date before expiry", () => {
      expect(isLicenceValidOnDate(lic, new Date("2026-06-15"))).toBe(true);
    });

    it("is valid on the exact expiry date", () => {
      expect(isLicenceValidOnDate(lic, new Date("2026-12-31T12:00:00Z"))).toBe(true);
    });

    it("is invalid on a date strictly after expiry", () => {
      expect(isLicenceValidOnDate(lic, new Date("2027-01-02T00:00:00Z"))).toBe(false);
    });

    it("is valid indefinitely if expiresAt is null", () => {
      const noExpiry = { ...baseLicence, expiresAt: null };
      expect(isLicenceValidOnDate(noExpiry, new Date("2035-12-31"))).toBe(true);
      expect(isLicenceValidOnDate(noExpiry, new Date("2099-01-01"))).toBe(true);
    });

    it("matches specific required class when requested", () => {
      expect(isLicenceValidOnDate(lic, new Date("2026-06-01"), { classRequired: "LF" })).toBe(true);
      expect(isLicenceValidOnDate(lic, new Date("2026-06-01"), { classRequired: "C6" })).toBe(false);
    });
  });

  describe("Status Derivation from Expiry & Warn Days", () => {
    const referenceDate = new Date("2026-06-01T00:00:00Z");
    const warnDays = 30;

    it("derives EXPIRED when expiry is past", () => {
      const past = new Date("2026-05-30T00:00:00Z");
      expect(deriveUserLicenceStatus(past, warnDays, referenceDate)).toBe("EXPIRED");
    });

    it("derives EXPIRING_SOON when expiry is within warnDays window", () => {
      const withinWarn = new Date("2026-06-15T00:00:00Z"); // 14 days away
      expect(deriveUserLicenceStatus(withinWarn, warnDays, referenceDate)).toBe("EXPIRING_SOON");
    });

    it("derives VALID when expiry is beyond warnDays window", () => {
      const future = new Date("2026-08-01T00:00:00Z"); // 61 days away
      expect(deriveUserLicenceStatus(future, warnDays, referenceDate)).toBe("VALID");
    });

    it("derives VALID when expiresAt is null", () => {
      expect(deriveUserLicenceStatus(null, warnDays, referenceDate)).toBe("VALID");
    });
  });

  describe("Aggregate Holder Counting & Deduplication", () => {
    it("counts a user once per licence type even if they hold multiple classes", () => {
      const user = { id: "user-multiclass", isActive: true };
      const licenceLF = { ...baseLicence, id: "l-1", userId: user.id, class: "LF", user };
      const licenceOpen = { ...baseLicence, id: "l-2", userId: user.id, class: "Open", user };

      const counts = calculateHolderCounts([licenceLF, licenceOpen], {
        typeId: "type-forklift",
      });

      expect(counts.validHolders).toBe(1);
    });

    it("excludes deactivated users from valid holders", () => {
      const activeUserRecord = { id: "u-active", isActive: true };
      const inactiveUserRecord = { id: "u-inactive", isActive: false };

      const lic1 = { ...baseLicence, id: "l-1", userId: "u-active", user: activeUserRecord };
      const lic2 = { ...baseLicence, id: "l-2", userId: "u-inactive", user: inactiveUserRecord };

      const counts = calculateHolderCounts([lic1, lic2], {
        typeId: "type-forklift",
      });

      expect(counts.validHolders).toBe(1);
    });
  });

  describe("Property-Based Tests (fast-check)", () => {
    it("pbt: for any valid future date D and expiry date E >= D, isLicenceValidOnDate is always true", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2035-12-31") }),
          fc.integer({ min: 0, max: 3650 }), // days offset
          (targetDate, daysAhead) => {
            const expiryDate = new Date(targetDate.getTime() + daysAhead * 86400000);
            const lic = {
              ...baseLicence,
              expiresAt: expiryDate,
            };
            const result = isLicenceValidOnDate(lic, targetDate);
            return result === true;
          }
        ),
        { numRuns: 200 }
      );
    });

    it("pbt: for any date D strictly after expiry E, isLicenceValidOnDate is always false", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2020-01-01"), max: new Date("2035-12-31") }),
          fc.integer({ min: 1, max: 3650 }), // days past
          (expiryDate, daysPast) => {
            const targetDate = new Date(expiryDate.getTime() + daysPast * 86400000);
            const lic = {
              ...baseLicence,
              expiresAt: expiryDate,
            };
            const result = isLicenceValidOnDate(lic, targetDate);
            return result === false;
          }
        ),
        { numRuns: 200 }
      );
    });

    it("pbt: deriveUserLicenceStatus partitions date space into valid, expiring_soon, and expired consistently", () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date("2025-01-01"), max: new Date("2030-12-31") }),
          fc.integer({ min: 1, max: 90 }), // warn days
          fc.integer({ min: -365, max: 365 }), // delta days
          (refDate, warnDays, deltaDays) => {
            const expiry = new Date(refDate.getTime() + deltaDays * 86400000);
            const status = deriveUserLicenceStatus(expiry, warnDays, refDate);

            if (deltaDays < 0) {
              return status === "EXPIRED";
            } else if (deltaDays <= warnDays) {
              return status === "EXPIRING_SOON";
            } else {
              return status === "VALID";
            }
          }
        ),
        { numRuns: 200 }
      );
    });
  });
});
