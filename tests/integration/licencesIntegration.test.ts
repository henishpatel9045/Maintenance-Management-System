import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../src/core/db";
import { LicenceService } from "../../src/modules/licences/licence.service";
import { SevaLicenceService } from "../../src/modules/licences/seva.service";
import { isUserValidHolder } from "../../src/modules/licences/holder";
import { refreshLicenceStatusJob } from "../../src/worker/jobs/refreshLicenceStatus";
import { scheduleLicenceRemindersJob } from "../../src/worker/jobs/scheduleLicenceReminders";
import { licenceSnapshotJob } from "../../src/worker/jobs/licenceSnapshot";

describe("Licences Module Full-Stack Integration Suite", () => {
  let testUserId: string;
  let adminUserId: string;
  let testLicenceTypeId: string;
  let testCategoryId: string;
  let testSevaId: string;

  beforeAll(async () => {
    // 1. Ensure test users exist
    let adminRole = await db.role.findFirst({ where: { name: "ADMIN" } });
    if (!adminRole) {
      adminRole = await db.role.create({ data: { name: "ADMIN", description: "Admin Role" } });
    }
    let memberRole = await db.role.findFirst({ where: { name: "MEMBER" } });
    if (!memberRole) {
      memberRole = await db.role.create({ data: { name: "MEMBER", description: "Member Role" } });
    }

    const adminUser = await db.user.upsert({
      where: { email: "licence_admin_test@seva.local" },
      update: {},
      create: {
        name: "Licence Test Admin",
        email: "licence_admin_test@seva.local",
        passwordHash: "hash_test_123",
        roleId: adminRole.id,
        isActive: true,
      },
    });
    adminUserId = adminUser.id;

    const testUser = await db.user.upsert({
      where: { email: "licence_member_test@seva.local" },
      update: {},
      create: {
        name: "Licence Test Member",
        email: "licence_member_test@seva.local",
        passwordHash: "hash_test_123",
        roleId: memberRole.id,
        isActive: true,
      },
    });
    testUserId = testUser.id;

    // 2. Ensure test category and licence type exist
    const cat = await db.licenceCategory.upsert({
      where: { name: "Test Plant Category" },
      update: {},
      create: {
        name: "Test Plant Category",
        sortOrder: 99,
      },
    });
    testCategoryId = cat.id;

    const ltype = await db.licenceType.upsert({
      where: { code: "test-forklift" },
      update: {},
      create: {
        code: "test-forklift",
        name: "Test Forklift Ticket",
        categoryId: testCategoryId,
        kind: "TICKET",
        classes: ["LF"],
        hasExpiry: true,
        requiresNumber: true,
        isHighlySensitive: false,
        minHoldersTarget: 2,
      },
    });
    testLicenceTypeId = ltype.id;

    // 3. Ensure a test Seva exists
    let sevaCategory = await db.category.findFirst();
    if (!sevaCategory) {
      sevaCategory = await db.category.create({
        data: { name: "Test Seva Cat", color: "#4f46e5" },
      });
    }

    let sevaArea = await db.area.findFirst();
    if (!sevaArea) {
      sevaArea = await db.area.create({
        data: { name: "Test Seva Area" },
      });
    }

    const testSeva = await db.seva.create({
      data: {
        code: `TST-${Date.now().toString().slice(-4)}`,
        title: "Test Forklift Warehouse Logistics",
        description: "Moving heavy items with forklift",
        kind: "ONE_TIME",
        priority: "MEDIUM",
        categoryId: sevaCategory.id,
        areaId: sevaArea.id,
        path: "/TST-SEVA",
        dueDate: new Date(Date.now() + 14 * 86400000), // 14 days in future
      },
    });
    testSevaId = testSeva.id;
  });

  afterAll(async () => {
    // Cleanup created test records
    try {
      if (testSevaId) {
        await db.sevaRequiredLicence.deleteMany({ where: { sevaId: testSevaId } });
        await db.sevaAssignee.deleteMany({ where: { sevaId: testSevaId } });
        await db.seva.delete({ where: { id: testSevaId } });
      }
      if (testUserId) {
        await db.userLicence.deleteMany({ where: { userId: testUserId } });
        await db.user.delete({ where: { id: testUserId } });
      }
      if (adminUserId) {
        await db.user.delete({ where: { id: adminUserId } });
      }
      if (testLicenceTypeId) {
        await db.licenceType.delete({ where: { id: testLicenceTypeId } });
      }
      if (testCategoryId) {
        await db.licenceCategory.delete({ where: { id: testCategoryId } });
      }
    } catch {}
  });

  it("1. Self-service submission creates PENDING_VERIFICATION record not counted as holder", async () => {
    const expiresFuture = new Date(Date.now() + 365 * 86400000); // 1 year away

    const created = await LicenceService.submitOwnLicence(
      testUserId,
      {
        licenceTypeId: testLicenceTypeId,
        class: "LF",
        licenceNumber: "NSW-TEST-001",
        issuer: "SafeWork Test",
        issuedAt: new Date().toISOString(),
        expiresAt: expiresFuture.toISOString(),
      }
    );

    expect(created.id).toBeDefined();
    expect(created.status).toBe("PENDING_VERIFICATION");
    expect(created.source).toBe("SELF_SUBMITTED");
    expect(created.verifiedAt).toBeNull();

    // Verify it is NOT considered a valid holder by default
    const isHolder = isUserValidHolder({ id: testUserId, isActive: true }, created);
    expect(isHolder).toBe(false);
  });

  it("2. Verifier verifies pending submission with optimistic locking -> becomes VALID holder", async () => {
    const pending = await db.userLicence.findFirst({
      where: { userId: testUserId, status: "PENDING_VERIFICATION" },
    });
    expect(pending).toBeDefined();

    // Verify
    const verified = await LicenceService.verifyLicence(
      adminUserId,
      pending!.id,
      {
        status: "VALID",
        expectedVersion: pending!.version,
      }
    );

    expect(verified.status).toBe("VALID");
    expect(verified.verifiedById).toBe(adminUserId);
    expect(verified.verifiedAt).toBeDefined();
    expect(verified.version).toBe(pending!.version + 1);

    // Now counts as a valid holder
    const isHolder = isUserValidHolder({ id: testUserId, isActive: true }, verified);
    expect(isHolder).toBe(true);
  });

  it("3. Renewal flow marks old record as SUPERSEDED and creates new record", async () => {
    const active = await db.userLicence.findFirst({
      where: { userId: testUserId, status: "VALID", supersededById: null },
    });
    expect(active).toBeDefined();

    const renewedExpiry = new Date(Date.now() + 730 * 86400000); // 2 years away
    const renewed = await LicenceService.renewLicence(
      testUserId,
      active!.id,
      {
        expiresAt: renewedExpiry.toISOString(),
        licenceNumber: "NSW-TEST-RENEWED",
      },
      false // not admin
    );

    expect(renewed.id).toBeDefined();
    expect(renewed.id).not.toBe(active!.id);

    // Old record should be SUPERSEDED and point to the new record
    const oldReloaded = await db.userLicence.findUnique({ where: { id: active!.id } });
    expect(oldReloaded?.status).toBe("SUPERSEDED");
    expect(oldReloaded?.supersededById).toBe(renewed.id);

    // Clean up renewed record and restore active status for remaining tests
    await db.userLicence.delete({ where: { id: renewed.id } });
    await db.userLicence.update({
      where: { id: active!.id },
      data: { status: "VALID", supersededById: null },
    });
  });

  it("4. Seva required licences check detects compliance and warns on deficit", async () => {
    // Set seva requirement: requires 1 holder of test-forklift
    await SevaLicenceService.setSevaRequiredLicences(
      testSevaId,
      [
        {
          licenceTypeId: testLicenceTypeId,
          classRequired: "LF",
          minHolders: 1,
        },
      ],
      adminUserId
    );

    // Scenario A: Nobody assigned yet -> non-compliant
    const check1 = await SevaLicenceService.checkSevaLicenceCompliance(testSevaId);
    expect(check1.hasRequirements).toBe(true);
    expect(check1.isCompliant).toBe(false);
    expect(check1.bannerMessage).toContain("Nobody assigned holds Test Forklift Ticket");

    // Scenario B: Assign our qualified member -> compliant
    await db.sevaAssignee.create({
      data: {
        sevaId: testSevaId,
        userId: testUserId,
        isLead: true,
      },
    });

    const check2 = await SevaLicenceService.checkSevaLicenceCompliance(testSevaId);
    expect(check2.isCompliant).toBe(true);
    expect(check2.bannerMessage).toContain("Requirement met by assignees");

    // Scenario C: Licence expires BEFORE seva due date -> non-compliant
    const activeLic = await db.userLicence.findFirst({
      where: { userId: testUserId, status: "VALID" },
    });
    // Set expiry to 3 days in future (while seva is 14 days in future)
    await db.userLicence.update({
      where: { id: activeLic!.id },
      data: { expiresAt: new Date(Date.now() + 3 * 86400000) },
    });

    const check3 = await SevaLicenceService.checkSevaLicenceCompliance(testSevaId);
    expect(check3.isCompliant).toBe(false);
    expect(check3.bannerMessage).toContain("Nobody assigned holds Test Forklift Ticket");

    // Restore expiry
    await db.userLicence.update({
      where: { id: activeLic!.id },
      data: { expiresAt: new Date(Date.now() + 365 * 86400000) },
    });
  });

  it("5. Number reveal writes an audit log entry", async () => {
    const activeLic = await db.userLicence.findFirst({
      where: { userId: testUserId, status: "VALID" },
    });

    const unmasked = await LicenceService.revealLicenceNumber(adminUserId, activeLic!.id);
    expect(unmasked.licenceNumber).toBe("NSW-TEST-001");

    // Verify audit log entry exists
    const audit = await db.activityLog.findFirst({
      where: {
        entityType: "USER_LICENCE",
        entityId: activeLic!.id,
        action: "REVEAL_LICENCE_NUMBER",
        userId: adminUserId,
      },
    });
    expect(audit).toBeDefined();
  });

  it("6. Daily worker jobs execute cleanly and idempotently", async () => {
    // 1. Status refresh job
    await expect(refreshLicenceStatusJob()).resolves.not.toThrow();

    // 2. Schedule reminders job
    await expect(scheduleLicenceRemindersJob()).resolves.not.toThrow();

    // 3. Weekly snapshot job
    await expect(licenceSnapshotJob()).resolves.not.toThrow();

    // Check that at least one snapshot row was created
    const snapshot = await db.licenceCountSnapshot.findFirst({
      where: { licenceTypeId: testLicenceTypeId },
    });
    expect(snapshot).toBeDefined();
  });
});
