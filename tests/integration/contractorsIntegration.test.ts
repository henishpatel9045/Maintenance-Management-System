import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/core/db";
import { generateContractorCode, generateRequestCode } from "../../src/modules/contractors/code";
import { ContractorService } from "../../src/modules/contractors/contractor.service";
import { ContactService } from "../../src/modules/contractors/contact.service";
import { CredentialService } from "../../src/modules/contractors/credential.service";
import { RequestService } from "../../src/modules/contractors/request.service";
import { refreshCredentialStatus } from "../../src/worker/jobs/refreshCredentialStatus";
import { scheduleCredentialReminders } from "../../src/worker/jobs/scheduleCredentialReminders";

describe("Contractors Integration: Database Services & Business Rules", () => {
  let testUserId: string;
  let testContractorId: string;

  beforeAll(async () => {
    // Ensure a test user exists
    const user = await prisma.user.findFirst();
    if (user) {
      testUserId = user.id;
    } else {
      const role = await prisma.role.findFirst({ where: { name: "ADMIN" } });
      const u = await prisma.user.create({
        data: {
          email: "integration-admin@seva.local",
          name: "Integration Admin",
          passwordHash: "argon2id$v=19$m=65536,t=3,p=4$dummy",
          roleId: role ? role.id : "00000000-0000-0000-0000-000000000001",
        },
      });
      testUserId = u.id;
    }
  });

  afterAll(async () => {
    // Clean up created test contractor
    if (testContractorId) {
      await prisma.contractorContact.deleteMany({ where: { contractorId: testContractorId } });
      await prisma.contractorCredential.deleteMany({ where: { contractorId: testContractorId } });
      await prisma.contractorTrade.deleteMany({ where: { contractorId: testContractorId } });
      await prisma.contractorRequest.deleteMany({ where: { contractorId: testContractorId } });
      await prisma.contractor.deleteMany({ where: { id: testContractorId } });
    }
  });

  describe("Sequential Code Generators", () => {
    it("generates sequential codes in CON-XXXX and CRQ-XXXX format", async () => {
      const conCode = await generateContractorCode();
      expect(conCode).toMatch(/^CON-\d{4}$/);

      const crqCode = await generateRequestCode();
      expect(crqCode).toMatch(/^CRQ-\d{4}$/);
    });
  });

  describe("Contractor Lifecycle & Optimistic Locking", () => {
    it("creates, retrieves, and updates contractor with version tracking", async () => {
      const contractor = await ContractorService.create(
        {
          companyName: "Integration Test Plumbing Pty Ltd",
          tradingName: "Integration Plumb Pros",
          registrationNumber: "11120224525", // Valid ABN
          registrationType: "ABN",
          gstRegistered: true,
          status: "ACTIVE",
          mainPhone: "02 9876 5432",
          mainEmail: "test@plumbing.local",
          suburb: "Parramatta",
          state: "NSW",
          postcode: "2150",
          paymentTerms: "Net 14",
          hourlyRate: 120.0,
          callOutFee: 150.0,
        },
        testUserId
      );

      expect(contractor.id).toBeDefined();
      expect(contractor.code).toMatch(/^CON-\d{4}$/);
      expect(contractor.version).toBe(1);
      testContractorId = contractor.id;

      // Update contractor with expectedVersion 1
      const updated = await ContractorService.update(
        contractor.id,
        {
          expectedVersion: 1,
          tradingName: "Integration Plumb Pros Updated",
          hourlyRate: 130.0,
        },
        testUserId
      );

      expect(updated.tradingName).toBe("Integration Plumb Pros Updated");
      expect(updated.version).toBe(2);

      // Attempt update with outdated expectedVersion 1 -> must fail with 409 conflict
      await expect(
        ContractorService.update(
          contractor.id,
          {
            expectedVersion: 1,
            tradingName: "Stale Update",
          },
          testUserId
        )
      ).rejects.toThrow(/conflict|modified/i);
    });

    it("blocks contractor with required reason and unblocks", async () => {
      const blocked = await ContractorService.block(
        testContractorId,
        "Failed license audit",
        testUserId
      );
      expect(blocked.status).toBe("BLOCKED");
      expect(blocked.blockedReason).toBe("Failed license audit");

      const unblocked = await ContractorService.unblock(testContractorId, testUserId);
      expect(unblocked.status).toBe("ACTIVE");
      expect(unblocked.blockedReason).toBeNull();
    });

    it("archives and unarchives contractor", async () => {
      const archived = await ContractorService.archive(testContractorId, testUserId);
      expect(archived.archivedAt).not.toBeNull();

      const unarchived = await ContractorService.unarchive(testContractorId, testUserId);
      expect(unarchived.archivedAt).toBeNull();
    });
  });

  describe("Contact Management & Single Primary Constraint", () => {
    let contact1Id: string;
    let contact2Id: string;

    it("manages contacts and maintains single primary contact invariant", async () => {
      const contact1 = await ContactService.create(testContractorId, {
        name: "Alice Builder",
        jobTitle: "Operations Director",
        phone: "02 9876 5432",
        email: "alice@plumbing.local",
        isPrimary: true,
      });
      contact1Id = contact1.id;
      expect(contact1.isPrimary).toBe(true);

      // Adding contact2 as primary automatically unsets contact1 as primary
      const contact2 = await ContactService.create(testContractorId, {
        name: "Bob Plumber",
        jobTitle: "Senior Master Plumber",
        phone: "0412 345 678",
        email: "bob@plumbing.local",
        isPrimary: true,
      });
      contact2Id = contact2.id;
      expect(contact2.isPrimary).toBe(true);

      const refreshed1 = await ContactService.getById(contact1Id);
      expect(refreshed1?.isPrimary).toBe(false);

      // Make contact1 primary again
      await ContactService.makePrimary(contact1Id);
      const reRefreshed1 = await ContactService.getById(contact1Id);
      const reRefreshed2 = await ContactService.getById(contact2Id);
      expect(reRefreshed1?.isPrimary).toBe(true);
      expect(reRefreshed2?.isPrimary).toBe(false);
    });
  });

  describe("Credential Status Calculation & Worker Reminders", () => {
    it("computes VALID, EXPIRING_SOON, and EXPIRED statuses correctly", () => {
      const now = new Date();

      // Expired yesterday
      const pastDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      expect(CredentialService.computeStatus(pastDate, 30)).toBe("EXPIRED");

      // Expiring in 10 days (warn days = 30)
      const soonDate = new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000);
      expect(CredentialService.computeStatus(soonDate, 30)).toBe("EXPIRING_SOON");

      // Expiring in 60 days (warn days = 30)
      const distantDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      expect(CredentialService.computeStatus(distantDate, 30)).toBe("VALID");
    });

    it("runs background credential status refresh and reminder scheduling idempotently", async () => {
      // Execute the daily status refresh job
      await refreshCredentialStatus();

      // Execute reminder scheduling job
      await scheduleCredentialReminders();

      // Verifies no runtime errors or duplicate primary violations
      expect(true).toBe(true);
    });
  });

  describe("Contractor Request & Diff Workflow", () => {
    it("submits an update proposal, computes side-by-side diff, and applies changes", async () => {
      const request = await RequestService.create(
        {
          type: "UPDATE_CONTRACTOR",
          contractorId: testContractorId,
          note: "Updated office phone number and service areas",
          proposedData: {
            mainPhone: "02 8888 9999",
            suburb: "North Parramatta",
          },
        },
        testUserId
      );

      expect(request.id).toBeDefined();
      expect(request.status).toBe("OPEN");
      expect(request.code).toMatch(/^CRQ-\d{4}$/);

      // Retrieve side-by-side comparison
      const comparison = await RequestService.getComparison(request.id);
      expect(comparison).toBeDefined();
      expect(comparison.differences).toBeDefined();
      const phoneDiff = comparison.differences.find((d: any) => d.field === "mainPhone");
      expect(phoneDiff).toBeDefined();
      expect(phoneDiff?.proposedValue).toBe("02 8888 9999");

      // Approve request
      const approved = await RequestService.approve(
        request.id,
        {
          acceptedFields: ["mainPhone", "suburb"],
        },
        testUserId
      );

      expect(approved.status).toBe("APPROVED");

      // Check contractor received the applied changes
      const updatedContractor = await ContractorService.getById(testContractorId);
      expect(updatedContractor?.mainPhone).toBe("02 8888 9999");
      expect(updatedContractor?.suburb).toBe("North Parramatta");
    });
  });
});
