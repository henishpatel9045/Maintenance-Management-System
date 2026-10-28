import {
  PrismaClient,
  SevaKind,
  SevaSubKind,
  Priority,
  ScheduleMode,
  OccurrenceStatus,
  RecurrenceFrequency,
  FileBucket,
  ArtefactType,
  ArtefactStage,
  QuoteStatus,
  ContractorStatus,
  CredentialKind,
  CredentialStatus,
  SevaContractorRole,
  SevaContractorStatus,
  ContractorRequestType,
  ContractorRequestStatus,
  LicenceKind,
  UserLicenceStatus,
  UserLicenceSource,
  UserAvailabilityStatus,
} from "@prisma/client";
import { hashPassword } from "../src/core/auth/hash";

const prisma = new PrismaClient();

const ALL_PERMISSIONS = [
  "seva.read",
  "seva.create",
  "seva.update",
  "seva.archive",
  "seva.assign",
  "occurrence.updateStatus",
  "comments.create",
  "artefacts.view",
  "artefacts.upload",
  "artefacts.manage",
  "quotes.view",
  "quotes.upload",
  "quotes.manage",
  "files.download",
  "reports.view",
  "requests.create",
  "requests.manage",
  "users.manage",
  "masters.manage",
  "settings.manage",
  "audit.view",
  // Contractors module permissions
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
  // Licences module permissions
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

const COORDINATOR_PERMISSIONS = [
  "seva.read",
  "occurrence.updateStatus",
  "comments.create",
  "artefacts.view",
  "artefacts.upload",
  "artefacts.manage",
  "quotes.view",
  "quotes.upload",
  "quotes.manage",
  "files.download",
  "reports.view",
  "requests.create",
  "requests.manage",
  "masters.manage",
  "seva.assign",
  // Contractors (all except import and manage)
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
  // Licences coordinator keys
  "licences.own.view",
  "licences.own.submit",
  "licences.directory.view",
  "licences.directory.contact",
  "licences.seva.require",
  "licences.reports.view",
];

const MEMBER_PERMISSIONS = [
  "seva.read",
  "occurrence.updateStatus",
  "comments.create",
  "artefacts.view",
  "artefacts.upload",
  "files.download",
  "requests.create",
  // Contractors (read and request)
  "contractors.read",
  "contractors.request",
  // Licences member keys
  "licences.own.view",
  "licences.own.submit",
];

export async function main() {
  console.log("Starting database seed...");

  // 1. Roles & Permissions
  const adminRole = await prisma.role.upsert({
    where: { name: "ADMIN" },
    update: {},
    create: {
      name: "ADMIN",
      description: "Full system administrator with unrestricted access",
      isSystem: true,
    },
  });

  const coordinatorRole = await prisma.role.upsert({
    where: { name: "COORDINATOR" },
    update: {},
    create: {
      name: "COORDINATOR",
      description: "Coordinates seva tasks, manages quotes, artefacts and assignments",
      isSystem: true,
    },
  });

  const memberRole = await prisma.role.upsert({
    where: { name: "MEMBER" },
    update: {},
    create: {
      name: "MEMBER",
      description: "Community member completing assigned seva, commenting and submitting requests",
      isSystem: true,
    },
  });

  // Seed permissions
  for (const perm of ALL_PERMISSIONS) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: adminRole.id, permissionKey: perm } },
      update: {},
      create: { roleId: adminRole.id, permissionKey: perm },
    });
  }

  for (const perm of COORDINATOR_PERMISSIONS) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: coordinatorRole.id, permissionKey: perm } },
      update: {},
      create: { roleId: coordinatorRole.id, permissionKey: perm },
    });
  }

  for (const perm of MEMBER_PERMISSIONS) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionKey: { roleId: memberRole.id, permissionKey: perm } },
      update: {},
      create: { roleId: memberRole.id, permissionKey: perm },
    });
  }

  // 2. Initial Admin User
  const adminEmail = process.env.ADMIN_EMAIL || "admin@seva.local";
  const adminName = process.env.ADMIN_NAME || "System Administrator";
  const adminPassword = process.env.ADMIN_PASSWORD || "AdminSeva2026!ChangeMe";
  const adminPasswordHash = await hashPassword(adminPassword);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { passwordHash: adminPasswordHash },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: adminPasswordHash,
      roleId: adminRole.id,
      isActive: true,
      mustChangePassword: true,
    },
  });

  console.log(`Admin user seeded: ${adminEmail}`);

  // 3. Default Categories
  const categories = [
    { name: "AC", color: "#0284c7", icon: "AirVent", description: "Heating, ventilation, and air conditioning" },
    { name: "Flooring", color: "#d97706", icon: "Layers", description: "Carpets, tiles, timber and flooring care" },
    { name: "Landscaping", color: "#16a34a", icon: "Trees", description: "Gardening, trees, lawns and grounds" },
    { name: "Networking", color: "#9333ea", icon: "Wifi", description: "Cables, Wi-Fi, audio/visual and IT infra" },
    { name: "Others", color: "#64748b", icon: "MoreHorizontal", description: "General repairs and miscellaneous seva" },
  ];

  const catMap = new Map<string, string>();
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    catMap.set(cat.name, c.id);
  }

  // 4. Default Areas (Tree)
  let mainComplex = await prisma.area.findFirst({ where: { name: "Main Complex" } });
  if (!mainComplex) {
    mainComplex = await prisma.area.create({
      data: { name: "Main Complex", sortOrder: 1 },
    });
  }

  let groundFloor = await prisma.area.findFirst({ where: { name: "Ground Floor", parentId: mainComplex.id } });
  if (!groundFloor) {
    groundFloor = await prisma.area.create({
      data: { name: "Ground Floor", parentId: mainComplex.id, sortOrder: 1 },
    });
  }

  const roomNames = ["Prayer Hall", "Dining Hall", "Kitchen"];
  const roomMap = new Map<string, string>();
  for (let i = 0; i < roomNames.length; i++) {
    const rName = roomNames[i]!;
    let r = await prisma.area.findFirst({ where: { name: rName, parentId: groundFloor.id } });
    if (!r) {
      r = await prisma.area.create({
        data: { name: rName, parentId: groundFloor.id, sortOrder: i + 1 },
      });
    }
    roomMap.set(rName, r.id);
  }

  let firstFloor = await prisma.area.findFirst({ where: { name: "First Floor", parentId: mainComplex.id } });
  if (!firstFloor) {
    firstFloor = await prisma.area.create({
      data: { name: "First Floor", parentId: mainComplex.id, sortOrder: 2 },
    });
  }

  let office = await prisma.area.findFirst({ where: { name: "Office", parentId: firstFloor.id } });
  if (!office) {
    office = await prisma.area.create({
      data: { name: "Office", parentId: firstFloor.id, sortOrder: 1 },
    });
  }

  let outdoors = await prisma.area.findFirst({ where: { name: "Gardens & Outdoors" } });
  if (!outdoors) {
    outdoors = await prisma.area.create({
      data: { name: "Gardens & Outdoors", sortOrder: 2 },
    });
  }

  // 5. Default Settings
  const defaultSettings: Record<string, unknown> = {
    membersSeeAllSeva: true,
    membersCanUploadArtefacts: true,
    assigneesCanUpdateStatus: true,
    coordinatorsCanEditSeva: false,
    membersCanViewReports: false,
    maxSevaDepth: 6,
    recurrenceHorizonDays: 90,
    reminderDaysBefore: 1,
    orgName: "Mount Gambier Community Seva",
    timezone: "Australia/Adelaide",
    currency: "AUD",
    maxImageMB: 10,
    maxDocMB: 25,
    maxVideoMB: 50,
    maxZipMB: 200,
    "module.seva.enabled": true,
    "module.files.enabled": true,
    "module.users.enabled": true,
    "module.masters.enabled": true,
    "module.comments.enabled": true,
    "module.dashboard.enabled": true,
    "module.reports.enabled": true,
    "module.notifications.enabled": true,
    "module.settings.enabled": true,
    "module.audit.enabled": true,
    "module.search.enabled": true,
  };

  for (const [key, val] of Object.entries(defaultSettings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: val as any },
    });
  }

  // 6. Demo Seed if SEED_DEMO is true
  const isDemo = process.env.SEED_DEMO === "true" || process.env.SEED_DEMO === "1";
  if (isDemo) {
    console.log("Seeding comprehensive demo dataset...");

    // Demo Coordinator & Members
    const defaultPass = await hashPassword("SevaMember2026!");

    const coordinator = await prisma.user.upsert({
      where: { email: "coordinator@seva.local" },
      update: {},
      create: {
        name: "Kiran Patel",
        email: "coordinator@seva.local",
        phone: "+61 400 111 222",
        passwordHash: defaultPass,
        roleId: coordinatorRole.id,
        isActive: true,
      },
    });

    const member1 = await prisma.user.upsert({
      where: { email: "aarav@seva.local" },
      update: {},
      create: {
        name: "Aarav Sharma",
        email: "aarav@seva.local",
        phone: "+61 400 222 333",
        passwordHash: defaultPass,
        roleId: memberRole.id,
        isActive: true,
      },
    });

    const member2 = await prisma.user.upsert({
      where: { email: "priya@seva.local" },
      update: {},
      create: {
        name: "Priya Singh",
        email: "priya@seva.local",
        phone: "+61 400 333 444",
        passwordHash: defaultPass,
        roleId: memberRole.id,
        isActive: true,
      },
    });

    const member3 = await prisma.user.upsert({
      where: { email: "rajesh@seva.local" },
      update: {},
      create: {
        name: "Rajesh Kumar",
        email: "rajesh@seva.local",
        phone: "+61 400 444 555",
        passwordHash: defaultPass,
        roleId: memberRole.id,
        isActive: true,
      },
    });

    // Tags
    const tags = ["Urgent Fix", "Periodic", "Electrical", "Plumbing", "Safety"];
    const tagMap = new Map<string, string>();
    for (const t of tags) {
      const tagRecord = await prisma.tag.upsert({
        where: { name: t },
        update: {},
        create: { name: t },
      });
      tagMap.set(t, tagRecord.id);
    }

    // Seva Tree:
    // Root Group: SEV-0001 Rebuilding Mount Gambier Temple
    let rootProject = await prisma.seva.findUnique({ where: { code: "SEV-0001" } });
    if (!rootProject) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      rootProject = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0001",
          title: "Rebuilding Mount Gambier Temple",
          description: "Comprehensive community rebuilding project including prayer hall expansion and site restoration.",
          kind: SevaKind.ONE_TIME,
          subKind: SevaSubKind.NEW,
          categoryId: catMap.get("Others")!,
          areaId: mainComplex.id,
          priority: Priority.HIGH,
          isGroup: true,
          path: `/${tempId}/`,
          depth: 0,
          sortOrder: 1,
          createdById: adminUser.id,
        },
      });
    }

    // Child Group: SEV-0002 Main Hall Renovation
    let hallGroup = await prisma.seva.findUnique({ where: { code: "SEV-0002" } });
    if (!hallGroup) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      hallGroup = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0002",
          title: "Main Hall Renovation",
          description: "Structural reinforcement and interior finishes for the main prayer sanctuary.",
          kind: SevaKind.ONE_TIME,
          subKind: SevaSubKind.REPAIR,
          categoryId: catMap.get("Others")!,
          areaId: groundFloor.id,
          priority: Priority.HIGH,
          parentId: rootProject.id,
          isGroup: true,
          path: `${rootProject.path}${tempId}/`,
          depth: 1,
          sortOrder: 1,
          createdById: adminUser.id,
        },
      });
    }

    // Leaf 1 under Hall: SEV-0003 Roof Structural Repairs
    let roofSeva = await prisma.seva.findUnique({ where: { code: "SEV-0003" } });
    if (!roofSeva) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      roofSeva = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0003",
          title: "Roof Structural Repairs & Truss Reinforcement",
          description: "Replace degraded timber trusses and repair flashing over the main sanctuary.",
          kind: SevaKind.ONE_TIME,
          subKind: SevaSubKind.REPAIR,
          categoryId: catMap.get("Others")!,
          areaId: roomMap.get("Prayer Hall") || groundFloor.id,
          priority: Priority.URGENT,
          parentId: hallGroup.id,
          isGroup: false,
          path: `${hallGroup.path}${tempId}/`,
          depth: 2,
          sortOrder: 1,
          estimatedBudget: 15000,
          approvedBudget: 14500,
          createdById: adminUser.id,
        },
      });

      // Assignees (Aarav as lead, Priya)
      await prisma.sevaAssignee.createMany({
        data: [
          { sevaId: roofSeva.id, userId: member1.id, isLead: true, assignedById: adminUser.id },
          { sevaId: roofSeva.id, userId: member2.id, isLead: false, assignedById: adminUser.id },
        ],
      });

      // Checklist items
      await prisma.checklistItem.createMany({
        data: [
          { sevaId: roofSeva.id, text: "Erect safety scaffolding", sortOrder: 1 },
          { sevaId: roofSeva.id, text: "Inspect timber truss integrity", sortOrder: 2 },
          { sevaId: roofSeva.id, text: "Install reinforced steel brackets", sortOrder: 3 },
          { sevaId: roofSeva.id, text: "Seal roof joints against moisture", sortOrder: 4 },
        ],
      });

      // Single occurrence for ONE_TIME
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      const occ = await prisma.occurrence.create({
        data: {
          sevaId: roofSeva.id,
          dueDate,
          status: OccurrenceStatus.IN_PROGRESS,
          startedAt: new Date(),
        },
      });

      // Demo Quotes for SEV-0003
      const quoteFile1 = await prisma.fileObject.create({
        data: {
          storageKey: `seva/SEV-0003/quotes/quote-southern-roof.pdf`,
          originalName: "Southern_Roof_Masters_Quotation.pdf",
          mimeType: "application/pdf",
          sizeBytes: BigInt(245000),
          sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          uploadedById: coordinator.id,
        },
      });

      await prisma.sevaFile.create({
        data: {
          sevaId: roofSeva.id,
          fileObjectId: quoteFile1.id,
          bucket: FileBucket.QUOTE,
          supplierName: "Southern Roof Masters",
          amount: 14500,
          currency: "AUD",
          quoteStatus: QuoteStatus.APPROVED,
          notes: "Selected for best warranty and included structural engineer certificate.",
          approvedById: adminUser.id,
          approvedAt: new Date(),
          createdById: coordinator.id,
        },
      });

      const quoteFile2 = await prisma.fileObject.create({
        data: {
          storageKey: `seva/SEV-0003/quotes/quote-mg-roofing.pdf`,
          originalName: "Mount_Gambier_Roofing_Proposal.pdf",
          mimeType: "application/pdf",
          sizeBytes: BigInt(310000),
          sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856",
          uploadedById: coordinator.id,
        },
      });

      await prisma.sevaFile.create({
        data: {
          sevaId: roofSeva.id,
          fileObjectId: quoteFile2.id,
          bucket: FileBucket.QUOTE,
          supplierName: "Mount Gambier Roofing Co",
          amount: 16800,
          currency: "AUD",
          quoteStatus: QuoteStatus.RECEIVED,
          notes: "Alternative competitive tender.",
          createdById: coordinator.id,
        },
      });

      // Demo Artefact
      const artefactFile = await prisma.fileObject.create({
        data: {
          storageKey: `seva/SEV-0003/artefacts/roof-truss-inspection.jpg`,
          originalName: "roof_truss_damage_inspection.jpg",
          mimeType: "image/jpeg",
          sizeBytes: BigInt(1800000),
          sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b857",
          uploadedById: member1.id,
        },
      });

      await prisma.sevaFile.create({
        data: {
          sevaId: roofSeva.id,
          occurrenceId: occ.id,
          fileObjectId: artefactFile.id,
          bucket: FileBucket.ARTEFACT,
          artefactType: ArtefactType.PHOTO,
          stage: ArtefactStage.BEFORE,
          caption: "Visible moisture deterioration on eastern perimeter truss beam.",
          createdById: member1.id,
        },
      });

      // Demo Comment with @mention
      await prisma.comment.create({
        data: {
          entityType: "SEVA",
          entityId: roofSeva.id,
          userId: coordinator.id,
          body: "Approved quotation with Southern Roof Masters. @Aarav Sharma please coordinate safety briefing before commencing roof access.",
        },
      });
    }

    // Leaf 2: SEV-0004 Teak Wood Flooring
    let floorSeva = await prisma.seva.findUnique({ where: { code: "SEV-0004" } });
    if (!floorSeva) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      floorSeva = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0004",
          title: "Teak Wood Flooring Installation",
          description: "Install polished Australian teak hardwood flooring across sanctuary floor.",
          kind: SevaKind.ONE_TIME,
          subKind: SevaSubKind.NEW,
          categoryId: catMap.get("Flooring")!,
          areaId: roomMap.get("Prayer Hall") || groundFloor.id,
          priority: Priority.MEDIUM,
          parentId: hallGroup.id,
          isGroup: false,
          path: `${hallGroup.path}${tempId}/`,
          depth: 2,
          sortOrder: 2,
          estimatedBudget: 8500,
          createdById: adminUser.id,
        },
      });

      await prisma.sevaAssignee.create({
        data: { sevaId: floorSeva.id, userId: member3.id, isLead: true, assignedById: adminUser.id },
      });

      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);
      await prisma.occurrence.create({
        data: {
          sevaId: floorSeva.id,
          dueDate,
          status: OccurrenceStatus.PENDING,
        },
      });
    }

    // Recurring Seva 1: SEV-0006 Monthly AC Filter Cleaning
    let acSeva = await prisma.seva.findUnique({ where: { code: "SEV-0006" } });
    if (!acSeva) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      acSeva = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0006",
          title: "Monthly AC Filter Cleaning & Inspection",
          description: "Clean dust filters, verify refrigerant pressure and inspect condensation drip trays across all units.",
          kind: SevaKind.RECURRING,
          categoryId: catMap.get("AC")!,
          areaId: mainComplex.id,
          priority: Priority.MEDIUM,
          scheduleMode: ScheduleMode.FIXED,
          isGroup: false,
          path: `/${tempId}/`,
          depth: 0,
          sortOrder: 2,
          createdById: adminUser.id,
        },
      });

      await prisma.recurrenceRule.create({
        data: {
          sevaId: acSeva.id,
          frequency: RecurrenceFrequency.MONTHLY,
          interval: 1,
          byMonthDay: [1],
          byWeekday: [],
          startDate: new Date(),
        },
      });

      await prisma.sevaAssignee.createMany({
        data: [
          { sevaId: acSeva.id, userId: coordinator.id, isLead: true, assignedById: adminUser.id },
          { sevaId: acSeva.id, userId: member3.id, isLead: false, assignedById: adminUser.id },
        ],
      });

      // Generate 3 monthly occurrences
      for (let m = 0; m < 3; m++) {
        const d = new Date();
        d.setMonth(d.getMonth() + m);
        d.setDate(1);
        d.setHours(9, 0, 0, 0);

        await prisma.occurrence.create({
          data: {
            sevaId: acSeva.id,
            dueDate: d,
            status: m === 0 ? OccurrenceStatus.IN_PROGRESS : OccurrenceStatus.PENDING,
          },
        });
      }
    }

    // Recurring Seva 2: SEV-0007 Weekly Garden Watering
    let gardenSeva = await prisma.seva.findUnique({ where: { code: "SEV-0007" } });
    if (!gardenSeva) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      gardenSeva = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0007",
          title: "Weekly Garden Watering & Grounds Care",
          description: "Water flower beds, prune walkways, and check irrigation lines in outdoor areas.",
          kind: SevaKind.RECURRING,
          categoryId: catMap.get("Landscaping")!,
          areaId: outdoors.id,
          priority: Priority.LOW,
          scheduleMode: ScheduleMode.FIXED,
          isGroup: false,
          path: `/${tempId}/`,
          depth: 0,
          sortOrder: 3,
          createdById: adminUser.id,
        },
      });

      await prisma.recurrenceRule.create({
        data: {
          sevaId: gardenSeva.id,
          frequency: RecurrenceFrequency.WEEKLY,
          interval: 1,
          byWeekday: [1], // Monday
          byMonthDay: [],
          startDate: new Date(),
        },
      });

      await prisma.sevaAssignee.create({
        data: { sevaId: gardenSeva.id, userId: member2.id, isLead: true, assignedById: adminUser.id },
      });

      // Generate 4 weekly occurrences
      for (let w = 0; w < 4; w++) {
        const d = new Date();
        d.setDate(d.getDate() + w * 7);
        d.setHours(8, 0, 0, 0);

        await prisma.occurrence.create({
          data: {
            sevaId: gardenSeva.id,
            dueDate: d,
            status: OccurrenceStatus.PENDING,
          },
        });
      }
    }
  }

  // ==========================================
  // SECTION 8: CONTRACTORS MODULE SEEDING
  // ==========================================
  console.log("Seeding Contractors module settings, trades, and master data...");

  // 1. Settings
  const contractorSettings = [
    { key: "module.contractors.enabled", value: true },
    { key: "membersCanViewContractorRates", value: false },
    { key: "contractorExpiryWarnDays", value: 30 },
    { key: "contractorReminderDays", value: [60, 30, 7, 0] },
    { key: "contractorRequestMaxOpenPerUser", value: 5 },
    { key: "contractorRequestMaxPerDay", value: 10 },
    { key: "contractorRequestReminderDays", value: 7 },
    { key: "contractorImportMaxRows", value: 2000 },
    { key: "contractorImportMaxMB", value: 2 },
  ];

  for (const s of contractorSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    });
  }

  // 2. Trades (16 master trades)
  const tradeNames = [
    "Electrical",
    "Plumbing",
    "HVAC and AC",
    "Landscaping",
    "Networking and IT",
    "Flooring",
    "Carpentry",
    "Painting",
    "Roofing",
    "Cleaning",
    "Pest control",
    "Security",
    "Concrete",
    "Welding",
    "Fire safety",
    "Others",
  ];

  const tradeMap = new Map<string, string>();
  for (let i = 0; i < tradeNames.length; i++) {
    const name = tradeNames[i]!;
    const t = await prisma.trade.upsert({
      where: { name },
      update: {},
      create: {
        name,
        description: `Professional ${name} services and maintenance`,
        isActive: true,
        sortOrder: i + 1,
      },
    });
    tradeMap.set(name, t.id);
  }

  // 3. CategoryTrade mappings
  const categoryTradeMappings: [string, string][] = [
    ["AC", "HVAC and AC"],
    ["Networking", "Networking and IT"],
    ["Landscaping", "Landscaping"],
    ["Flooring", "Flooring"],
  ];

  for (const [catName, tradeName] of categoryTradeMappings) {
    const catId = catMap.get(catName);
    const trId = tradeMap.get(tradeName);
    if (catId && trId) {
      await prisma.categoryTrade.upsert({
        where: { categoryId_tradeId: { categoryId: catId, tradeId: trId } },
        update: {},
        create: { categoryId: catId, tradeId: trId },
      });
    }
  }

  // ==========================================
  // MODULE: Licences - Settings & Master Data
  // ==========================================
  const licenceSettings = [
    { key: "module.licences.enabled", value: true },
    { key: "membersCanSubmitOwnLicences", value: true },
    { key: "membersCanViewLicenceDirectory", value: false },
    { key: "coordinatorsCanManageLicences", value: false },
    { key: "licenceEnforcement", value: "WARN" },
    { key: "licenceExpiryWarnDays", value: 30 },
    { key: "licenceReminderDays", value: [60, 30, 7, 0] },
    { key: "countPendingAsHolders", value: false },
    { key: "licenceSubmitMaxPendingPerUser", value: 5 },
    { key: "licenceSubmitMaxPerDay", value: 10 },
    { key: "licenceImportMaxRows", value: 2000 },
    { key: "licenceImportMaxMB", value: 2 },
  ];

  for (const s of licenceSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value },
    });
  }

  // Categories
  const licenceCategoriesData = [
    { name: "Plant and Equipment", sortOrder: 1 },
    { name: "Working at Heights", sortOrder: 2 },
    { name: "Electrical and Trades", sortOrder: 3 },
    { name: "First Aid and Safety", sortOrder: 4 },
    { name: "Driving and Transport", sortOrder: 5 },
    { name: "Site Induction", sortOrder: 6 },
    { name: "Compliance and Checks", sortOrder: 7 },
    { name: "Other", sortOrder: 8 },
  ];

  const licenceCatMap = new Map<string, string>();
  for (const cat of licenceCategoriesData) {
    const record = await prisma.licenceCategory.upsert({
      where: { name: cat.name },
      update: { sortOrder: cat.sortOrder },
      create: cat,
    });
    licenceCatMap.set(cat.name, record.id);
  }

  // Licence Types
  const licenceTypesData = [
    {
      code: "forklift",
      name: "Forklift",
      categoryName: "Plant and Equipment",
      kind: LicenceKind.LICENCE,
      issuer: "SafeWork SA / WorkSafe",
      aliases: ["LF", "Forklift ticket", "High Risk Work Forklift"],
      classes: ["LF"],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 5,
      description: "High risk work licence class LF for operating forklift trucks.",
      sortOrder: 1,
    },
    {
      code: "ewp",
      name: "Elevated Work Platform (EWP)",
      categoryName: "Plant and Equipment",
      kind: LicenceKind.TICKET,
      issuer: "Elevating Work Platform Association (EWPA) / WorkSafe",
      aliases: ["Yellow card", "Boom lift", "Scissor lift", "WP"],
      classes: ["under 11m", "over 11m"],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 3,
      description: "Operator training card and HRW licence for boom and scissor lifts.",
      sortOrder: 2,
    },
    {
      code: "white-card",
      name: "White Card (construction induction)",
      categoryName: "Site Induction",
      kind: LicenceKind.CERTIFICATE,
      issuer: "SafeWork Australia",
      aliases: ["General Construction Induction", "CIC Card"],
      classes: [],
      hasExpiry: false,
      defaultValidityMonths: null,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 8,
      description: "Mandatory general construction induction training card.",
      sortOrder: 3,
    },
    {
      code: "first-aid",
      name: "First Aid",
      categoryName: "First Aid and Safety",
      kind: LicenceKind.CERTIFICATE,
      issuer: "St John Ambulance / Red Cross",
      aliases: ["HLTAID011", "Provide First Aid", "Senior First Aid"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 36,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 4,
      description: "HLTAID011 Provide First Aid unit of competency.",
      sortOrder: 4,
    },
    {
      code: "cpr",
      name: "CPR",
      categoryName: "First Aid and Safety",
      kind: LicenceKind.CERTIFICATE,
      issuer: "St John Ambulance / Red Cross",
      aliases: ["HLTAID009", "Provide Cardiopulmonary Resuscitation"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 12,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 4,
      description: "HLTAID009 Annual CPR refresher certification.",
      sortOrder: 5,
    },
    {
      code: "working-at-heights",
      name: "Working at Heights",
      categoryName: "Working at Heights",
      kind: LicenceKind.TICKET,
      issuer: "RTO / SafeWork",
      aliases: ["RIIWHS204E", "Height Safety", "Working Safely at Heights"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 24,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 3,
      description: "Competency to work safely at heights on roofs, scaffolding, and ladders.",
      sortOrder: 6,
    },
    {
      code: "confined-space",
      name: "Confined Space",
      categoryName: "First Aid and Safety",
      kind: LicenceKind.TICKET,
      issuer: "RTO / SafeWork",
      aliases: ["RIIWHS202E", "Enter and work in confined spaces"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 24,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 2,
      description: "Ticket to inspect, enter and work within confined spaces.",
      sortOrder: 7,
    },
    {
      code: "electrical-licence",
      name: "Electrical licence",
      categoryName: "Electrical and Trades",
      kind: LicenceKind.LICENCE,
      issuer: "Consumer and Business Services (CBS)",
      aliases: ["A-Grade Electrician", "PGE Electrician", "Electrical Worker"],
      classes: ["Contractor", "Worker", "Restricted"],
      hasExpiry: true,
      defaultValidityMonths: 36,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 2,
      description: "State regulatory occupational licence for electrical installation work.",
      sortOrder: 8,
    },
    {
      code: "dogging-rigging",
      name: "Dogging and Rigging",
      categoryName: "Plant and Equipment",
      kind: LicenceKind.LICENCE,
      issuer: "SafeWork SA",
      aliases: ["DG", "RB", "RI", "RA", "High Risk Work Rigging"],
      classes: ["Dogging (DG)", "Basic Rigging (RB)", "Intermediate (RI)"],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 1,
      description: "High risk work licence for slinging loads and guiding crane operations.",
      sortOrder: 9,
    },
    {
      code: "crane-operation",
      name: "Crane operation",
      categoryName: "Plant and Equipment",
      kind: LicenceKind.LICENCE,
      issuer: "SafeWork SA",
      aliases: ["C2", "C6", "C1", "Mobile Crane"],
      classes: ["C2 - Slewing up to 20t", "C6 - Slewing up to 60t", "CN - Non-slewing"],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 1,
      description: "High risk work licence for operating slewing or non-slewing cranes.",
      sortOrder: 10,
    },
    {
      code: "fire-warden",
      name: "Fire Warden",
      categoryName: "First Aid and Safety",
      kind: LicenceKind.CERTIFICATE,
      issuer: "Fire Protection Association Australia / RTO",
      aliases: ["Emergency Warden", "Chief Warden", "PUAFER005"],
      classes: ["Floor Warden", "Chief Warden"],
      hasExpiry: true,
      defaultValidityMonths: 24,
      requiresNumber: false,
      isHighlySensitive: false,
      minHoldersTarget: 3,
      description: "Site emergency evacuation management and fire warden certification.",
      sortOrder: 11,
    },
    {
      code: "chemical-handling",
      name: "Chemical Handling",
      categoryName: "First Aid and Safety",
      kind: LicenceKind.CERTIFICATE,
      issuer: "ChemCert / RTO",
      aliases: ["AgVet Chemical", "Dangerous Goods Handling", "Hazardous Substances"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 36,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 2,
      description: "Safe handling, storage, and transport of hazardous chemicals and pesticides.",
      sortOrder: 12,
    },
    {
      code: "heavy-vehicle",
      name: "Heavy vehicle driver licence",
      categoryName: "Driving and Transport",
      kind: LicenceKind.LICENCE,
      issuer: "Department for Infrastructure and Transport",
      aliases: ["MR", "HR", "HC", "MC", "Truck Licence"],
      classes: ["MR", "HR", "HC", "MC"],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: false,
      minHoldersTarget: 2,
      description: "Medium Rigid, Heavy Rigid, Heavy Combination truck driving licence.",
      sortOrder: 13,
    },
    {
      code: "driver-licence",
      name: "Driver licence",
      categoryName: "Driving and Transport",
      kind: LicenceKind.LICENCE,
      issuer: "Service SA / State Transport Authority",
      aliases: ["C Class", "Car Licence", "Driver's Licence"],
      classes: ["C", "C-A"],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: true,
      minHoldersTarget: 5,
      description: "Standard Class C motor vehicle driver licence.",
      sortOrder: 14,
    },
    {
      code: "wwcc",
      name: "Working with Children Check",
      categoryName: "Compliance and Checks",
      kind: LicenceKind.CERTIFICATE,
      issuer: "DHS Screening Unit",
      aliases: ["WWCC", "Child-Related Screening", "Working With Children"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 60,
      requiresNumber: true,
      isHighlySensitive: true,
      minHoldersTarget: 6,
      description: "State background check screening for working with children and vulnerable people.",
      sortOrder: 15,
    },
    {
      code: "police-check",
      name: "Police Check",
      categoryName: "Compliance and Checks",
      kind: LicenceKind.CERTIFICATE,
      issuer: "Australian Federal Police / State Police",
      aliases: ["National Police Certificate", "NPC", "Criminal History Check"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 36,
      requiresNumber: true,
      isHighlySensitive: true,
      minHoldersTarget: 4,
      description: "National criminal history check for volunteers and staff.",
      sortOrder: 16,
    },
    {
      code: "first-aid-officer",
      name: "First Aid Officer",
      categoryName: "First Aid and Safety",
      kind: LicenceKind.COMPETENCY,
      issuer: "Seva Safety Committee",
      aliases: ["Designated First Aider", "First Aid Marshall"],
      classes: [],
      hasExpiry: true,
      defaultValidityMonths: 12,
      requiresNumber: false,
      isHighlySensitive: false,
      minHoldersTarget: 2,
      description: "Appointed site first aid officer with current CPR and first aid competencies.",
      sortOrder: 17,
    },
    {
      code: "other",
      name: "Other",
      categoryName: "Other",
      kind: LicenceKind.COMPETENCY,
      issuer: "Various",
      aliases: ["Miscellaneous Ticket", "Specialist Competency"],
      classes: [],
      hasExpiry: false,
      defaultValidityMonths: null,
      requiresNumber: false,
      isHighlySensitive: false,
      minHoldersTarget: null,
      description: "Any other specialised licence, ticket, certificate, or recognised competency.",
      sortOrder: 18,
    },
  ];

  const licenceTypeMap = new Map<string, string>();
  for (const t of licenceTypesData) {
    const categoryId = licenceCatMap.get(t.categoryName)!;
    const record = await prisma.licenceType.upsert({
      where: { code: t.code },
      update: {
        name: t.name,
        categoryId,
        kind: t.kind,
        issuer: t.issuer,
        aliases: t.aliases,
        classes: t.classes,
        hasExpiry: t.hasExpiry,
        defaultValidityMonths: t.defaultValidityMonths,
        requiresNumber: t.requiresNumber,
        isHighlySensitive: t.isHighlySensitive,
        minHoldersTarget: t.minHoldersTarget,
        description: t.description,
        sortOrder: t.sortOrder,
      },
      create: {
        code: t.code,
        name: t.name,
        categoryId,
        kind: t.kind,
        issuer: t.issuer,
        aliases: t.aliases,
        classes: t.classes,
        hasExpiry: t.hasExpiry,
        defaultValidityMonths: t.defaultValidityMonths,
        requiresNumber: t.requiresNumber,
        isHighlySensitive: t.isHighlySensitive,
        minHoldersTarget: t.minHoldersTarget,
        description: t.description,
        sortOrder: t.sortOrder,
      },
    });
    licenceTypeMap.set(t.code, record.id);
  }

  // 4. Demo Data (8 contractors across trades, contacts, credentials, reviews, seva links, requests)
  if (isDemo) {
    console.log("Seeding Demo Contractors dataset...");

    // Helper to get dates relative to now
    const now = new Date();
    const daysFromNow = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    // Fetch existing users for relations
    const coordinatorUser = await prisma.user.findFirst({ where: { role: { name: "COORDINATOR" } } });
    const memberUser = await prisma.user.findFirst({ where: { role: { name: "MEMBER" } } });
    const cUserId = coordinatorUser?.id || adminUser.id;
    const mUserId = memberUser?.id || adminUser.id;

    // CON-0001: Southern Roof Masters Pty Ltd
    const con1 = await prisma.contractor.upsert({
      where: { code: "CON-0001" },
      update: {},
      create: {
        code: "CON-0001",
        companyName: "Southern Roof Masters Pty Ltd",
        tradingName: "Southern Roof Masters",
        registrationNumber: "51824753556",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        isPreferred: true,
        website: "https://www.southernroof.com.au",
        mainPhone: "08 8725 1100",
        mainEmail: "info@southernroof.com.au",
        addressLine1: "42 Commercial Street West",
        suburb: "Mount Gambier",
        state: "SA",
        postcode: "5290",
        country: "AU",
        serviceAreas: ["Mount Gambier", "Limestone Coast", "Penola"],
        afterHoursAvailable: true,
        emergencyPhone: "0412 888 999",
        paymentTerms: "14 days from invoice",
        callOutFee: 150.0,
        hourlyRate: 95.0,
        currency: "AUD",
        internalNotes: "Preferred structural roof and truss specialists. High reliability on past jobs.",
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Roofing")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con1.id, tradeId: tradeMap.get("Roofing")! } },
        update: {},
        create: { contractorId: con1.id, tradeId: tradeMap.get("Roofing")!, isPrimary: true },
      });
    }
    if (tradeMap.get("Carpentry")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con1.id, tradeId: tradeMap.get("Carpentry")! } },
        update: {},
        create: { contractorId: con1.id, tradeId: tradeMap.get("Carpentry")!, isPrimary: false },
      });
    }

    const con1Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con1.id } });
    if (!con1Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con1.id,
          name: "Lachlan Murdoch",
          jobTitle: "Operations Director",
          phone: "08 8725 1100",
          mobile: "0412 888 999",
          email: "lachlan@southernroof.com.au",
          isPrimary: true,
          notes: "Primary contact for structural repair bookings",
        },
      });
    }

    const con1Cred = await prisma.contractorCredential.findFirst({ where: { contractorId: con1.id } });
    if (!con1Cred) {
      await prisma.contractorCredential.createMany({
        data: [
          {
            contractorId: con1.id,
            kind: CredentialKind.INSURANCE,
            type: "Public Liability Insurance",
            issuer: "QBE Australia",
            number: "POL-QBE-882914",
            coverAmount: 20000000.0,
            issuedAt: daysFromNow(-180),
            expiresAt: daysFromNow(185),
            status: CredentialStatus.VALID,
            verifiedById: adminUser.id,
            verifiedAt: daysFromNow(-180),
          },
          {
            contractorId: con1.id,
            kind: CredentialKind.LICENCE,
            type: "Structural Roof Builder Licence",
            issuer: "Consumer and Business Services SA",
            number: "BLD-SA-29184",
            issuedAt: daysFromNow(-365),
            expiresAt: daysFromNow(730),
            status: CredentialStatus.VALID,
            verifiedById: adminUser.id,
            verifiedAt: daysFromNow(-365),
          },
        ],
      });
    }

    // Link demo quote for Southern Roof Masters on SEV-0003
    await prisma.sevaFile.updateMany({
      where: { supplierName: "Southern Roof Masters" },
      data: { contractorId: con1.id },
    });

    // Seva link for SEV-0003
    const sev3 = await prisma.seva.findUnique({ where: { code: "SEV-0003" } });
    if (sev3) {
      await prisma.sevaContractor.upsert({
        where: { sevaId_contractorId_role: { sevaId: sev3.id, contractorId: con1.id, role: SevaContractorRole.PRIMARY } },
        update: {},
        create: {
          sevaId: sev3.id,
          contractorId: con1.id,
          role: SevaContractorRole.PRIMARY,
          scope: "Truss reinforcement and roof sheeting repairs",
          status: SevaContractorStatus.ENGAGED,
          quotedAmount: 14500.0,
          finalAmount: 14500.0,
          engagedAt: daysFromNow(-7),
          createdById: cUserId,
        },
      });
    }

    // Review for CON-0001
    const con1Review = await prisma.contractorReview.findFirst({ where: { contractorId: con1.id } });
    if (!con1Review) {
      await prisma.contractorReview.create({
        data: {
          contractorId: con1.id,
          sevaId: sev3?.id ?? null,
          rating: 5,
          qualityRating: 5,
          timelinessRating: 5,
          priceRating: 4,
          wouldUseAgain: true,
          comment: "Outstanding performance on the main sanctuary roof repairs. Crew was on time and safety compliance was spotless.",
          reviewedById: cUserId,
        },
      });
    }

    // CON-0002: Apex Commercial Roofing
    const con2 = await prisma.contractor.upsert({
      where: { code: "CON-0002" },
      update: {},
      create: {
        code: "CON-0002",
        companyName: "Apex Commercial Roofing Solutions",
        tradingName: "Apex Roofing",
        registrationNumber: "33123456789",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        website: "https://www.apexroofing.com.au",
        mainPhone: "08 8200 4500",
        mainEmail: "tenders@apexroofing.com.au",
        addressLine1: "15 Industrial Avenue",
        suburb: "Mount Gambier",
        state: "SA",
        postcode: "5290",
        country: "AU",
        serviceAreas: ["Limestone Coast"],
        hourlyRate: 110.0,
        paymentTerms: "30 days",
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Roofing")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con2.id, tradeId: tradeMap.get("Roofing")! } },
        update: {},
        create: { contractorId: con2.id, tradeId: tradeMap.get("Roofing")!, isPrimary: true },
      });
    }

    const con2Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con2.id } });
    if (!con2Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con2.id,
          name: "Mark Evans",
          jobTitle: "Senior Estimator",
          phone: "08 8200 4500",
          mobile: "0422 111 222",
          email: "mark@apexroofing.com.au",
          isPrimary: true,
        },
      });
    }

    // Link demo quote for Apex Commercial Roofing on SEV-0003
    await prisma.sevaFile.updateMany({
      where: { supplierName: "Apex Commercial Roofing" },
      data: { contractorId: con2.id },
    });

    if (sev3) {
      await prisma.sevaContractor.upsert({
        where: { sevaId_contractorId_role: { sevaId: sev3.id, contractorId: con2.id, role: SevaContractorRole.PRIMARY } },
        update: {},
        create: {
          sevaId: sev3.id,
          contractorId: con2.id,
          role: SevaContractorRole.PRIMARY,
          scope: "Alternative quotation for roof truss repair",
          status: SevaContractorStatus.QUOTED,
          quotedAmount: 16200.0,
          createdById: cUserId,
        },
      });
    }

    // CON-0003: Adelaide Chill HVAC (Expiring insurance in 15 days)
    const con3 = await prisma.contractor.upsert({
      where: { code: "CON-0003" },
      update: {},
      create: {
        code: "CON-0003",
        companyName: "Adelaide Chill HVAC & Refrigeration Pty Ltd",
        tradingName: "Adelaide Chill",
        registrationNumber: "12345678901",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        isPreferred: true,
        website: "https://www.adelaidechill.com.au",
        mainPhone: "08 8300 2200",
        mainEmail: "service@adelaidechill.com.au",
        addressLine1: "88 South Road",
        suburb: "Edwardstown",
        state: "SA",
        postcode: "5039",
        country: "AU",
        serviceAreas: ["Adelaide Metro", "Limestone Coast", "Regional SA"],
        afterHoursAvailable: true,
        emergencyPhone: "0433 999 111",
        callOutFee: 180.0,
        hourlyRate: 125.0,
        paymentTerms: "14 days",
        internalNotes: "Serviced all community split systems and ducted AC. Excellent responsiveness.",
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("HVAC and AC")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con3.id, tradeId: tradeMap.get("HVAC and AC")! } },
        update: {},
        create: { contractorId: con3.id, tradeId: tradeMap.get("HVAC and AC")!, isPrimary: true },
      });
    }

    const con3Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con3.id } });
    if (!con3Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con3.id,
          name: "Dave Miller",
          jobTitle: "Lead Technician",
          phone: "08 8300 2200",
          mobile: "0433 999 111",
          email: "dave@adelaidechill.com.au",
          isPrimary: true,
        },
      });
    }

    const con3Cred = await prisma.contractorCredential.findFirst({ where: { contractorId: con3.id } });
    if (!con3Cred) {
      await prisma.contractorCredential.createMany({
        data: [
          {
            contractorId: con3.id,
            kind: CredentialKind.INSURANCE,
            type: "Public Liability Insurance",
            issuer: "Allianz Insurance",
            number: "ALZ-992140",
            coverAmount: 10000000.0,
            issuedAt: daysFromNow(-350),
            expiresAt: daysFromNow(15), // Expiring in 15 days! (EXPIRING_SOON)
            status: CredentialStatus.EXPIRING_SOON,
            verifiedById: adminUser.id,
            verifiedAt: daysFromNow(-350),
          },
          {
            contractorId: con3.id,
            kind: CredentialKind.LICENCE,
            type: "Refrigerant Handling Licence",
            issuer: "Australian Refrigeration Council",
            number: "ARC-L09812",
            issuedAt: daysFromNow(-200),
            expiresAt: daysFromNow(500),
            status: CredentialStatus.VALID,
          },
        ],
      });
    }

    // CON-0004: VoltSafe Electrical Solutions (EXPIRED insurance)
    const con4 = await prisma.contractor.upsert({
      where: { code: "CON-0004" },
      update: {},
      create: {
        code: "CON-0004",
        companyName: "VoltSafe Electrical Solutions",
        tradingName: "VoltSafe Electrical",
        registrationNumber: "45678901234",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        mainPhone: "08 8455 6789",
        mainEmail: "admin@voltsafe.com.au",
        addressLine1: "12 Power Court",
        suburb: "Mount Gambier",
        state: "SA",
        postcode: "5290",
        country: "AU",
        serviceAreas: ["Mount Gambier", "Naracoorte"],
        callOutFee: 120.0,
        hourlyRate: 98.0,
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Electrical")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con4.id, tradeId: tradeMap.get("Electrical")! } },
        update: {},
        create: { contractorId: con4.id, tradeId: tradeMap.get("Electrical")!, isPrimary: true },
      });
    }

    const con4Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con4.id } });
    if (!con4Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con4.id,
          name: "Sarah Jenkins",
          jobTitle: "Operations Manager",
          phone: "08 8455 6789",
          mobile: "0444 222 333",
          email: "sarah@voltsafe.com.au",
          isPrimary: true,
        },
      });
    }

    const con4Cred = await prisma.contractorCredential.findFirst({ where: { contractorId: con4.id } });
    if (!con4Cred) {
      await prisma.contractorCredential.createMany({
        data: [
          {
            contractorId: con4.id,
            kind: CredentialKind.INSURANCE,
            type: "Public Liability Insurance",
            issuer: "CGU Insurance",
            number: "CGU-PL-77123",
            coverAmount: 10000000.0,
            issuedAt: daysFromNow(-380),
            expiresAt: daysFromNow(-10), // Expired 10 days ago!
            status: CredentialStatus.EXPIRED,
          },
          {
            contractorId: con4.id,
            kind: CredentialKind.LICENCE,
            type: "Electrical Contractor Licence",
            issuer: "SA Consumer & Business Services",
            number: "PGE-281923",
            issuedAt: daysFromNow(-300),
            expiresAt: daysFromNow(400),
            status: CredentialStatus.VALID,
          },
        ],
      });
    }

    // CON-0005: GreenThumb Commercial Landscaping
    const con5 = await prisma.contractor.upsert({
      where: { code: "CON-0005" },
      update: {},
      create: {
        code: "CON-0005",
        companyName: "GreenThumb Grounds & Commercial Landscaping",
        tradingName: "GreenThumb Landscaping",
        registrationNumber: "98765432109",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        isPreferred: true,
        website: "https://www.greenthumb.com.au",
        mainPhone: "08 8722 3456",
        mainEmail: "hello@greenthumb.com.au",
        addressLine1: "54 Jubilee Highway East",
        suburb: "Mount Gambier",
        state: "SA",
        postcode: "5290",
        country: "AU",
        serviceAreas: ["Limestone Coast"],
        hourlyRate: 75.0,
        paymentTerms: "14 days",
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Landscaping")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con5.id, tradeId: tradeMap.get("Landscaping")! } },
        update: {},
        create: { contractorId: con5.id, tradeId: tradeMap.get("Landscaping")!, isPrimary: true },
      });
    }

    const con5Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con5.id } });
    if (!con5Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con5.id,
          name: "Tim Green",
          jobTitle: "Head Groundsman",
          phone: "08 8722 3456",
          mobile: "0455 111 444",
          email: "tim@greenthumb.com.au",
          isPrimary: true,
        },
      });
    }

    // CON-0006: ProFloor Surfaces Pty Ltd
    const con6 = await prisma.contractor.upsert({
      where: { code: "CON-0006" },
      update: {},
      create: {
        code: "CON-0006",
        companyName: "ProFloor Commercial Surfaces Pty Ltd",
        tradingName: "ProFloor Surfaces",
        registrationNumber: "87654321098",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        mainPhone: "08 8555 1234",
        mainEmail: "sales@profloor.com.au",
        addressLine1: "33 Pine Street",
        suburb: "Mount Gambier",
        state: "SA",
        postcode: "5290",
        country: "AU",
        serviceAreas: ["Mount Gambier", "Millicent"],
        hourlyRate: 85.0,
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Flooring")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con6.id, tradeId: tradeMap.get("Flooring")! } },
        update: {},
        create: { contractorId: con6.id, tradeId: tradeMap.get("Flooring")!, isPrimary: true },
      });
    }

    const con6Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con6.id } });
    if (!con6Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con6.id,
          name: "John Clark",
          jobTitle: "Managing Director",
          phone: "08 8555 1234",
          mobile: "0466 333 777",
          email: "john@profloor.com.au",
          isPrimary: true,
        },
      });
    }

    // CON-0007: Rapid Response Plumbing & Drainage (BLOCKED)
    const con7 = await prisma.contractor.upsert({
      where: { code: "CON-0007" },
      update: {},
      create: {
        code: "CON-0007",
        companyName: "Rapid Response Plumbing & Drainage",
        tradingName: "Rapid Response Plumbing",
        registrationNumber: "76543210987",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.BLOCKED,
        blockedReason: "Unlicensed subcontractor brought on site and safety incident on 2026-03-15. Failed to provide incident report.",
        mainPhone: "08 8723 9900",
        mainEmail: "brett@rapidresponse.com.au",
        addressLine1: "99 Bay Road",
        suburb: "Mount Gambier",
        state: "SA",
        postcode: "5290",
        country: "AU",
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Plumbing")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con7.id, tradeId: tradeMap.get("Plumbing")! } },
        update: {},
        create: { contractorId: con7.id, tradeId: tradeMap.get("Plumbing")!, isPrimary: true },
      });
    }

    const con7Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con7.id } });
    if (!con7Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con7.id,
          name: "Brett White",
          jobTitle: "Proprietor",
          phone: "08 8723 9900",
          mobile: "0477 888 222",
          email: "brett@rapidresponse.com.au",
          isPrimary: true,
        },
      });
    }

    const con7Cred = await prisma.contractorCredential.findFirst({ where: { contractorId: con7.id } });
    if (!con7Cred) {
      await prisma.contractorCredential.create({
        data: {
          contractorId: con7.id,
          kind: CredentialKind.LICENCE,
          type: "Plumbing Contractor Licence",
          issuer: "SA Consumer & Business Services",
          number: "PGE-881230",
          status: CredentialStatus.REVOKED,
          notes: "Revoked following safety breach investigation.",
        },
      });
    }

    // CON-0008: NetPro Infrastructure Services
    const con8 = await prisma.contractor.upsert({
      where: { code: "CON-0008" },
      update: {},
      create: {
        code: "CON-0008",
        companyName: "NetPro Infrastructure Services",
        tradingName: "NetPro IT & Cabling",
        registrationNumber: "65432109876",
        registrationType: "ABN",
        gstRegistered: true,
        status: ContractorStatus.ACTIVE,
        isPreferred: true,
        website: "https://www.netproinfra.com.au",
        mainPhone: "08 8211 9900",
        mainEmail: "contact@netproinfra.com.au",
        addressLine1: "100 King William Street",
        suburb: "Adelaide",
        state: "SA",
        postcode: "5000",
        country: "AU",
        serviceAreas: ["Adelaide", "Limestone Coast", "Statewide"],
        hourlyRate: 115.0,
        paymentTerms: "14 days",
        createdById: adminUser.id,
      },
    });

    if (tradeMap.get("Networking and IT")) {
      await prisma.contractorTrade.upsert({
        where: { contractorId_tradeId: { contractorId: con8.id, tradeId: tradeMap.get("Networking and IT")! } },
        update: {},
        create: { contractorId: con8.id, tradeId: tradeMap.get("Networking and IT")!, isPrimary: true },
      });
    }

    const con8Contact = await prisma.contractorContact.findFirst({ where: { contractorId: con8.id } });
    if (!con8Contact) {
      await prisma.contractorContact.create({
        data: {
          contractorId: con8.id,
          name: "Anita Roy",
          jobTitle: "Lead Systems Engineer",
          phone: "08 8211 9900",
          mobile: "0488 555 123",
          email: "anita@netproinfra.com.au",
          isPrimary: true,
        },
      });
    }

    // Sample Requests:
    // 1. CRQ-0001 (NEW_CONTRACTOR, OPEN)
    await prisma.contractorRequest.upsert({
      where: { code: "CRQ-0001" },
      update: {},
      create: {
        code: "CRQ-0001",
        type: ContractorRequestType.NEW_CONTRACTOR,
        proposedData: {
          companyName: "Elite Fire & Safety Equipment",
          tradingName: "Elite Fire",
          registrationNumber: "21987654321",
          trades: [tradeMap.get("Fire safety")!],
          mainPhone: "08 8123 4567",
          mainEmail: "quotes@elitefire.com.au",
          suburb: "Mount Gambier",
          state: "SA",
          postcode: "5290",
          website: "https://www.elitefire.com.au",
          contacts: [
            {
              name: "Peter Howard",
              jobTitle: "Service Manager",
              phone: "08 8123 4567",
              email: "peter@elitefire.com.au",
              isPrimary: true,
            },
          ],
        },
        note: "Recommended by local council for annual fire extinguisher testing and kitchen suppression certification.",
        requestedById: mUserId,
        status: ContractorRequestStatus.OPEN,
      },
    });

    // 2. CRQ-0002 (UPDATE_CONTRACTOR, OPEN)
    await prisma.contractorRequest.upsert({
      where: { code: "CRQ-0002" },
      update: {},
      create: {
        code: "CRQ-0002",
        type: ContractorRequestType.UPDATE_CONTRACTOR,
        contractorId: con3.id,
        proposedData: {
          mainPhone: "08 8300 9999",
          afterHoursAvailable: true,
          emergencyPhone: "0499 111 000",
        },
        note: "They gave us their new 24/7 priority emergency dispatch line following the HVAC board meeting.",
        requestedById: mUserId,
        status: ContractorRequestStatus.OPEN,
      },
    });

    // 3. CRQ-0003 (NEW_CONTRACTOR, REJECTED)
    await prisma.contractorRequest.upsert({
      where: { code: "CRQ-0003" },
      update: {},
      create: {
        code: "CRQ-0003",
        type: ContractorRequestType.NEW_CONTRACTOR,
        proposedData: {
          companyName: "Budget Handyman Express",
          trades: [tradeMap.get("Others")!],
          mainPhone: "0400 000 111",
          suburb: "Mount Gambier",
        },
        note: "Cheap general handyman for small odd jobs.",
        requestedById: mUserId,
        status: ContractorRequestStatus.REJECTED,
        reviewedById: adminUser.id,
        reviewedAt: daysFromNow(-3),
        reviewNote: "Organisation policy mandates minimum $10M public liability insurance and registered trade licences. Uninsured handymen cannot be approved.",
      },
    });

    console.log("Demo Contractors dataset seeded successfully (8 contractors, requests, reviews).");

    // ==========================================
    // MODULE: Licences - Demo Data
    // ==========================================
    console.log("Seeding Demo Licences & Skills dataset...");

    const defaultPass = await hashPassword("SevaMember2026!");

    // 1. Extra demo members
    const demoMembers = [
      { name: "Ananya Desai", email: "ananya@seva.local", phone: "+61 400 555 666" },
      { name: "Vikram Mehta", email: "vikram@seva.local", phone: "+61 400 666 777" },
      { name: "Deepa Nair", email: "deepa@seva.local", phone: "+61 400 777 888" },
      { name: "Sunil Verma", email: "sunil@seva.local", phone: "+61 400 888 999" },
      { name: "Meera Joshi", email: "meera@seva.local", phone: "+61 400 999 000" },
      { name: "Arjun Reddy", email: "arjun@seva.local", phone: "+61 400 123 456" },
      { name: "Rohan Kapoor", email: "rohan@seva.local", phone: "+61 400 234 567" },
    ];

    const userMap = new Map<string, string>();
    userMap.set("admin", adminUser.id);
    if (coordinatorUser) userMap.set("coordinator", coordinatorUser.id);
    if (memberUser) userMap.set("member1", memberUser.id);

    const priya = await prisma.user.findFirst({ where: { email: "priya@seva.local" } });
    if (priya) userMap.set("member2", priya.id);

    const rajesh = await prisma.user.findFirst({ where: { email: "rajesh@seva.local" } });
    if (rajesh) userMap.set("member3", rajesh.id);

    for (let i = 0; i < demoMembers.length; i++) {
      const dm = demoMembers[i]!;
      const user = await prisma.user.upsert({
        where: { email: dm.email },
        update: {},
        create: {
          name: dm.name,
          email: dm.email,
          phone: dm.phone,
          passwordHash: defaultPass,
          roleId: memberRole.id,
          isActive: true,
        },
      });
      userMap.set(`member${i + 4}`, user.id);
    }

    // 2. User Availability
    const availabilityData = [
      { userId: userMap.get("member1")!, status: UserAvailabilityStatus.AVAILABLE, note: "Full availability, prefer morning seva" },
      { userId: userMap.get("member2")!, status: UserAvailabilityStatus.LIMITED, note: "Weekends only (Saturday mornings)" },
      { userId: userMap.get("member3")!, status: UserAvailabilityStatus.AVAILABLE, note: "Weekdays and Sundays" },
      { userId: userMap.get("member4")!, status: UserAvailabilityStatus.AVAILABLE, note: "Saturdays and Tuesdays" },
      { userId: userMap.get("member5")!, status: UserAvailabilityStatus.AVAILABLE, note: "Weekday afternoons" },
      { userId: userMap.get("member6")!, status: UserAvailabilityStatus.LIMITED, note: "School hours only (9am - 3pm)" },
      { userId: userMap.get("member7")!, status: UserAvailabilityStatus.UNAVAILABLE, note: "Interstate until next month", availableUntil: daysFromNow(25) },
      { userId: userMap.get("member8")!, status: UserAvailabilityStatus.AVAILABLE, note: "Anytime with 24h notice" },
      { userId: userMap.get("member9")!, status: UserAvailabilityStatus.AVAILABLE, note: "All weekends" },
      { userId: userMap.get("member10")!, status: UserAvailabilityStatus.LIMITED, note: "Evening shifts only" },
    ];

    for (const a of availabilityData) {
      if (!a.userId) continue;
      await prisma.userAvailability.upsert({
        where: { userId: a.userId },
        update: { status: a.status, note: a.note, availableUntil: a.availableUntil },
        create: {
          userId: a.userId,
          status: a.status,
          note: a.note,
          availableUntil: a.availableUntil,
        },
      });
    }

    // 3. User Licences
    const forkliftId = licenceTypeMap.get("forklift")!;
    const ewpId = licenceTypeMap.get("ewp")!;
    const whiteCardId = licenceTypeMap.get("white-card")!;
    const firstAidId = licenceTypeMap.get("first-aid")!;
    const driverLicenceId = licenceTypeMap.get("driver-licence")!;
    const wwccId = licenceTypeMap.get("wwcc")!;
    const electricalId = licenceTypeMap.get("electrical-licence")!;

    const licencesToSeed = [
      // Forklift: 6 holders (4 VALID, 1 EXPIRING_SOON, 1 EXPIRED)
      {
        userId: userMap.get("member1")!, // Aarav
        licenceTypeId: forkliftId,
        class: "LF",
        licenceNumber: "LF-SA-882194",
        issuer: "SafeWork SA",
        issuedAt: daysFromNow(-300),
        expiresAt: daysFromNow(400),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-300),
      },
      {
        userId: userMap.get("member3")!, // Rajesh
        licenceTypeId: forkliftId,
        class: "LF",
        licenceNumber: "LF-SA-512093",
        issuer: "SafeWork SA",
        issuedAt: daysFromNow(-200),
        expiresAt: daysFromNow(250),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-200),
      },
      {
        userId: userMap.get("member5")!, // Vikram
        licenceTypeId: forkliftId,
        class: "LF",
        licenceNumber: "LF-SA-394012",
        issuer: "SafeWork SA",
        issuedAt: daysFromNow(-100),
        expiresAt: daysFromNow(600),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-100),
      },
      {
        userId: userMap.get("member9")!, // Arjun
        licenceTypeId: forkliftId,
        class: "LF",
        licenceNumber: "LF-SA-774120",
        issuer: "SafeWork SA",
        issuedAt: daysFromNow(-150),
        expiresAt: daysFromNow(180),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-150),
      },
      {
        userId: userMap.get("member7")!, // Sunil
        licenceTypeId: forkliftId,
        class: "LF",
        licenceNumber: "LF-SA-192847",
        issuer: "SafeWork SA",
        issuedAt: daysFromNow(-700),
        expiresAt: daysFromNow(15), // EXPIRING_SOON (15 days)
        status: UserLicenceStatus.EXPIRING_SOON,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-700),
      },
      {
        userId: userMap.get("member10")!, // Rohan
        licenceTypeId: forkliftId,
        class: "LF",
        licenceNumber: "LF-SA-441290",
        issuer: "SafeWork SA",
        issuedAt: daysFromNow(-900),
        expiresAt: daysFromNow(-45), // EXPIRED (-45 days)
        status: UserLicenceStatus.EXPIRED,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-900),
      },

      // EWP: 3 VALID holders
      {
        userId: userMap.get("member1")!, // Aarav
        licenceTypeId: ewpId,
        class: "under 11m",
        licenceNumber: "EWP-99214",
        issuer: "EWPA",
        issuedAt: daysFromNow(-200),
        expiresAt: daysFromNow(300),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-200),
      },
      {
        userId: userMap.get("member5")!, // Vikram
        licenceTypeId: ewpId,
        class: "over 11m",
        licenceNumber: "EWP-88301",
        issuer: "WorkSafe SA",
        issuedAt: daysFromNow(-150),
        expiresAt: daysFromNow(450),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-150),
      },
      {
        userId: userMap.get("member4")!, // Ananya
        licenceTypeId: ewpId,
        class: "over 11m",
        licenceNumber: "EWP-77123",
        issuer: "WorkSafe SA",
        issuedAt: daysFromNow(-100),
        expiresAt: daysFromNow(500),
        status: UserLicenceStatus.VALID,
        source: UserLicenceSource.ADMIN_ENTERED,
        verifiedById: adminUser.id,
        verifiedAt: daysFromNow(-100),
      },

      // White Card: 8 VALID holders
      { userId: userMap.get("member1")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10294", issuer: "SafeWork Australia", issuedAt: daysFromNow(-400), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-400) },
      { userId: userMap.get("member2")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10295", issuer: "SafeWork Australia", issuedAt: daysFromNow(-350), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-350) },
      { userId: userMap.get("member3")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10296", issuer: "SafeWork Australia", issuedAt: daysFromNow(-300), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-300) },
      { userId: userMap.get("member4")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10297", issuer: "SafeWork Australia", issuedAt: daysFromNow(-250), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-250) },
      { userId: userMap.get("member5")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10298", issuer: "SafeWork Australia", issuedAt: daysFromNow(-200), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-200) },
      { userId: userMap.get("member6")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10299", issuer: "SafeWork Australia", issuedAt: daysFromNow(-150), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-150) },
      { userId: userMap.get("member7")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10300", issuer: "SafeWork Australia", issuedAt: daysFromNow(-100), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-100) },
      { userId: userMap.get("member8")!, licenceTypeId: whiteCardId, class: null, licenceNumber: "CGC-SA-10301", issuer: "SafeWork Australia", issuedAt: daysFromNow(-50), expiresAt: null, status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-50) },

      // First Aid: 4 VALID holders
      { userId: userMap.get("member2")!, licenceTypeId: firstAidId, class: null, licenceNumber: "FA-STJ-9921", issuer: "St John Ambulance", issuedAt: daysFromNow(-200), expiresAt: daysFromNow(200), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-200) },
      { userId: userMap.get("member6")!, licenceTypeId: firstAidId, class: null, licenceNumber: "FA-STJ-9922", issuer: "St John Ambulance", issuedAt: daysFromNow(-100), expiresAt: daysFromNow(350), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-100) },
      { userId: userMap.get("member8")!, licenceTypeId: firstAidId, class: null, licenceNumber: "FA-STJ-9923", issuer: "St John Ambulance", issuedAt: daysFromNow(-50), expiresAt: daysFromNow(400), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-50) },
      { userId: userMap.get("coordinator")!, licenceTypeId: firstAidId, class: null, licenceNumber: "FA-STJ-9924", issuer: "St John Ambulance", issuedAt: daysFromNow(-300), expiresAt: daysFromNow(120), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-300) },

      // Driver Licence (highly sensitive): 5 VALID holders
      { userId: userMap.get("member1")!, licenceTypeId: driverLicenceId, class: "C", licenceNumber: "D-SA-192847", issuer: "Service SA", issuedAt: daysFromNow(-500), expiresAt: daysFromNow(800), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-500) },
      { userId: userMap.get("member2")!, licenceTypeId: driverLicenceId, class: "C", licenceNumber: "D-SA-293848", issuer: "Service SA", issuedAt: daysFromNow(-400), expiresAt: daysFromNow(700), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-400) },
      { userId: userMap.get("member3")!, licenceTypeId: driverLicenceId, class: "C", licenceNumber: "D-SA-394859", issuer: "Service SA", issuedAt: daysFromNow(-600), expiresAt: daysFromNow(500), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-600) },
      { userId: userMap.get("member5")!, licenceTypeId: driverLicenceId, class: "C-A", licenceNumber: "D-SA-495860", issuer: "Service SA", issuedAt: daysFromNow(-300), expiresAt: daysFromNow(900), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-300) },
      { userId: userMap.get("member4")!, licenceTypeId: driverLicenceId, class: "C", licenceNumber: "D-SA-596871", issuer: "Service SA", issuedAt: daysFromNow(-200), expiresAt: daysFromNow(1000), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-200) },

      // WWCC (highly sensitive): 6 VALID holders
      { userId: userMap.get("member2")!, licenceTypeId: wwccId, class: null, licenceNumber: "WWCC-112233", issuer: "DHS Screening Unit", issuedAt: daysFromNow(-200), expiresAt: daysFromNow(1200), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-200) },
      { userId: userMap.get("member6")!, licenceTypeId: wwccId, class: null, licenceNumber: "WWCC-223344", issuer: "DHS Screening Unit", issuedAt: daysFromNow(-150), expiresAt: daysFromNow(1300), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-150) },
      { userId: userMap.get("member8")!, licenceTypeId: wwccId, class: null, licenceNumber: "WWCC-334455", issuer: "DHS Screening Unit", issuedAt: daysFromNow(-100), expiresAt: daysFromNow(1400), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-100) },
      { userId: userMap.get("coordinator")!, licenceTypeId: wwccId, class: null, licenceNumber: "WWCC-445566", issuer: "DHS Screening Unit", issuedAt: daysFromNow(-300), expiresAt: daysFromNow(1000), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-300) },
      { userId: userMap.get("member1")!, licenceTypeId: wwccId, class: null, licenceNumber: "WWCC-556677", issuer: "DHS Screening Unit", issuedAt: daysFromNow(-250), expiresAt: daysFromNow(1100), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-250) },
      { userId: userMap.get("member3")!, licenceTypeId: wwccId, class: null, licenceNumber: "WWCC-667788", issuer: "DHS Screening Unit", issuedAt: daysFromNow(-400), expiresAt: daysFromNow(900), status: UserLicenceStatus.VALID, source: UserLicenceSource.ADMIN_ENTERED, verifiedById: adminUser.id, verifiedAt: daysFromNow(-400) },

      // Pending self-submissions
      {
        userId: userMap.get("member6")!, // Deepa
        licenceTypeId: ewpId,
        class: "under 11m",
        licenceNumber: "EWP-PEND-01",
        issuer: "EWPA",
        issuedAt: daysFromNow(-5),
        expiresAt: daysFromNow(365 * 5),
        status: UserLicenceStatus.PENDING_VERIFICATION,
        source: UserLicenceSource.SELF_SUBMITTED,
        notes: "Completed EWPA yellow card course last weekend. Scan attached for admin verification.",
      },
      {
        userId: userMap.get("member10")!, // Rohan
        licenceTypeId: firstAidId,
        class: null,
        licenceNumber: "FA-PEND-02",
        issuer: "Australian Red Cross",
        issuedAt: daysFromNow(-2),
        expiresAt: daysFromNow(365 * 3),
        status: UserLicenceStatus.PENDING_VERIFICATION,
        source: UserLicenceSource.SELF_SUBMITTED,
        notes: "HLTAID011 certificate completed via Red Cross.",
      },
    ];

    for (const lic of licencesToSeed) {
      if (!lic.userId || !lic.licenceTypeId) continue;
      const existing = await prisma.userLicence.findFirst({
        where: {
          userId: lic.userId,
          licenceTypeId: lic.licenceTypeId,
          class: lic.class,
          archivedAt: null,
          supersededById: null,
        },
      });

      if (!existing) {
        await prisma.userLicence.create({
          data: {
            userId: lic.userId,
            licenceTypeId: lic.licenceTypeId,
            class: lic.class,
            licenceNumber: lic.licenceNumber,
            issuer: lic.issuer,
            issuedAt: lic.issuedAt,
            expiresAt: lic.expiresAt,
            status: lic.status,
            source: lic.source,
            verifiedById: lic.verifiedById,
            verifiedAt: lic.verifiedAt,
            notes: (lic as any).notes ?? null,
          },
        });
      }
    }

    // 4. Seva Requirements
    // Seva 1: SEV-0003 (Roof Structural Repairs) -> Assignee Aarav Sharma has Forklift + White Card
    const seva3 = await prisma.seva.findUnique({ where: { code: "SEV-0003" } });
    if (seva3) {
      // Ensure Aarav is assigned
      const aaravId = userMap.get("member1");
      if (aaravId) {
        await prisma.sevaAssignee.upsert({
          where: { sevaId_userId: { sevaId: seva3.id, userId: aaravId } },
          update: {},
          create: { sevaId: seva3.id, userId: aaravId, isLead: true },
        });
      }

      await prisma.sevaRequiredLicence.upsert({
        where: {
          sevaId_licenceTypeId_classRequired: {
            sevaId: seva3.id,
            licenceTypeId: forkliftId,
            classRequired: "",
          },
        },
        update: {},
        create: {
          sevaId: seva3.id,
          licenceTypeId: forkliftId,
          classRequired: "",
          minHolders: 1,
          createdById: adminUser.id,
        },
      });

      await prisma.sevaRequiredLicence.upsert({
        where: {
          sevaId_licenceTypeId_classRequired: {
            sevaId: seva3.id,
            licenceTypeId: whiteCardId,
            classRequired: "",
          },
        },
        update: {},
        create: {
          sevaId: seva3.id,
          licenceTypeId: whiteCardId,
          classRequired: "",
          minHolders: 1,
          createdById: adminUser.id,
        },
      });
    }

    // Seva 2: Create SEV-0005 (High Chandelier Maintenance) -> Assignee Rajesh Kumar (lacks EWP over 11m and Electrical)
    let seva5 = await prisma.seva.findUnique({ where: { code: "SEV-0005" } });
    if (!seva5) {
      const tempId = (await prisma.$queryRaw<{ id: string }[]>`SELECT gen_random_uuid() as id`)[0]?.id;
      seva5 = await prisma.seva.create({
        data: {
          id: tempId,
          code: "SEV-0005",
          title: "High Sanctuary Chandelier & Electrical Maintenance",
          description: "High-reach lighting maintenance requiring boom lift EWP (>11m) and electrical trade licence.",
          kind: SevaKind.ONE_TIME,
          subKind: SevaSubKind.REPAIR,
          categoryId: catMap.get("AC") || catMap.get("Others")!,
          areaId: groundFloor.id,
          priority: Priority.HIGH,
          path: `/${tempId}/`,
          depth: 0,
          sortOrder: 5,
          createdById: adminUser.id,
        },
      });

      const rajeshId = userMap.get("member3");
      if (rajeshId) {
        await prisma.sevaAssignee.create({
          data: { sevaId: seva5.id, userId: rajeshId, isLead: true },
        });
      }

      await prisma.sevaRequiredLicence.create({
        data: {
          sevaId: seva5.id,
          licenceTypeId: ewpId,
          classRequired: "over 11m",
          minHolders: 1,
          createdById: adminUser.id,
        },
      });

      await prisma.sevaRequiredLicence.create({
        data: {
          sevaId: seva5.id,
          licenceTypeId: electricalId,
          classRequired: "",
          minHolders: 1,
          createdById: adminUser.id,
        },
      });
    }

    // 5. 12 Weekly Snapshots
    for (let w = 12; w >= 1; w--) {
      const takenOn = new Date(now.getTime() - w * 7 * 24 * 60 * 60 * 1000);
      takenOn.setHours(0, 0, 0, 0);

      const snapshots = [
        { licenceTypeId: forkliftId, validHolders: Math.max(3, 5 - Math.floor(w / 4)), expiringSoon: 1, expired: 1, pending: 0 },
        { licenceTypeId: ewpId, validHolders: Math.max(1, 3 - Math.floor(w / 5)), expiringSoon: 0, expired: 0, pending: 1 },
        { licenceTypeId: whiteCardId, validHolders: Math.max(6, 8 - Math.floor(w / 6)), expiringSoon: 0, expired: 0, pending: 0 },
        { licenceTypeId: firstAidId, validHolders: Math.max(2, 4 - Math.floor(w / 4)), expiringSoon: 1, expired: 0, pending: 1 },
        { licenceTypeId: driverLicenceId, validHolders: 5, expiringSoon: 0, expired: 0, pending: 0 },
        { licenceTypeId: wwccId, validHolders: Math.max(4, 6 - Math.floor(w / 4)), expiringSoon: 0, expired: 0, pending: 0 },
      ];

      for (const snap of snapshots) {
        await prisma.licenceCountSnapshot.upsert({
          where: {
            takenOn_licenceTypeId: {
              takenOn,
              licenceTypeId: snap.licenceTypeId,
            },
          },
          update: {
            validHolders: snap.validHolders,
            expiringSoon: snap.expiringSoon,
            expired: snap.expired,
            pending: snap.pending,
          },
          create: {
            takenOn,
            licenceTypeId: snap.licenceTypeId,
            validHolders: snap.validHolders,
            expiringSoon: snap.expiringSoon,
            expired: snap.expired,
            pending: snap.pending,
          },
        });
      }
    }

    console.log("Demo Licences dataset seeded successfully (users, licences, availability, seva requirements, snapshots).");
  }

  console.log("Database seed completed successfully.");
}

if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
