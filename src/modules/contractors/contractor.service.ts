import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { generateContractorCode } from "./code";
import { sanitizeContractor, getContractorTierContext } from "./tiers";
import { AuthenticatedUser } from "@/core/permissions/can";
import { ContractorStatus, Prisma } from "@prisma/client";
import { CreateContractorInput, UpdateContractorInput } from "./schemas";

export async function ensureContractorsEnabled() {
  const setting = await db.setting.findUnique({
    where: { key: "module.contractors.enabled" },
  });
  if (setting && setting.value === false) {
    throw new AppError(404, "NOT_FOUND", "Contractors module is disabled");
  }
}

export interface ListContractorsFilters {
  q?: string;
  tradeId?: string;
  status?: ContractorStatus;
  isPreferred?: boolean;
  tag?: string;
  suburb?: string;
  state?: string;
  ratingMin?: number;
  afterHours?: boolean;
  hasValidInsurance?: boolean;
  credentialStatus?: string;
  expiringWithinDays?: number;
  usedOnSevaId?: string;
  page?: number;
  limit?: number;
  sortBy?: "companyName" | "rating" | "createdAt" | "code";
  sortOrder?: "asc" | "desc";
}

export class ContractorService {
  /**
   * Find possible duplicate contractors using PostgreSQL trigram similarity and registrationNumber.
   */
  public static async findDuplicates(params: {
    name?: string;
    registrationNumber?: string;
    registrationType?: string;
    excludeId?: string;
  }) {
    const { name, registrationNumber, registrationType, excludeId } = params;

    if (!name && !registrationNumber) {
      return [];
    }

    const conditions: Prisma.Sql[] = [Prisma.sql`c.archived_at IS NULL`];
    if (excludeId) {
      conditions.push(Prisma.sql`c.id != ${excludeId}::uuid`);
    }

    const matchClauses: Prisma.Sql[] = [];
    if (name && name.trim().length > 1) {
      const trimmed = name.trim();
      matchClauses.push(
        Prisma.sql`(
          c.company_name % ${trimmed} 
          OR COALESCE(c.trading_name, '') % ${trimmed} 
          OR similarity(c.company_name, ${trimmed}) > 0.6 
          OR similarity(COALESCE(c.trading_name, ''), ${trimmed}) > 0.6
        )`
      );
    }

    if (registrationNumber && registrationNumber.trim().length > 0) {
      const reg = registrationNumber.trim();
      if (registrationType) {
        matchClauses.push(
          Prisma.sql`(c.registration_number = ${reg} AND c.registration_type = ${registrationType})`
        );
      } else {
        matchClauses.push(Prisma.sql`c.registration_number = ${reg}`);
      }
    }

    if (matchClauses.length === 0) {
      return [];
    }

    conditions.push(Prisma.sql`(${Prisma.join(matchClauses, " OR ")})`);

    const query = Prisma.sql`
      SELECT 
        c.id,
        c.code,
        c.company_name AS "companyName",
        c.trading_name AS "tradingName",
        c.registration_number AS "registrationNumber",
        c.registration_type AS "registrationType",
        c.status,
        c.is_preferred AS "isPreferred",
        c.suburb,
        c.state,
        c.main_phone AS "mainPhone",
        c.main_email AS "mainEmail",
        CASE 
          WHEN ${name || ""} != '' THEN GREATEST(
            similarity(c.company_name, ${name || ""}),
            similarity(COALESCE(c.trading_name, ''), ${name || ""})
          )
          ELSE 0.0
        END AS "similarityScore"
      FROM contractors c
      WHERE ${Prisma.join(conditions, " AND ")}
      ORDER BY "similarityScore" DESC
      LIMIT 10
    `;

    const results = await db.$queryRaw<
      Array<{
        id: string;
        code: string;
        companyName: string;
        tradingName: string | null;
        registrationNumber: string | null;
        registrationType: string | null;
        status: ContractorStatus;
        isPreferred: boolean;
        suburb: string | null;
        state: string | null;
        mainPhone: string | null;
        mainEmail: string | null;
        similarityScore: number;
      }>
    >(query);

    return results;
  }

  /**
   * List contractors with rich filtering, search, sorting, and field-tier sanitization.
   */
  public static async list(filters: ListContractorsFilters, user: AuthenticatedUser) {
    const tierCtx = await getContractorTierContext(user);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ContractorWhereInput = {
      archivedAt: null,
    };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.isPreferred !== undefined) {
      where.isPreferred = filters.isPreferred;
    }

    if (filters.afterHours !== undefined) {
      where.afterHoursAvailable = filters.afterHours;
    }

    if (filters.suburb) {
      where.suburb = { contains: filters.suburb, mode: "insensitive" };
    }

    if (filters.state) {
      where.state = { contains: filters.state, mode: "insensitive" };
    }

    if (filters.tradeId) {
      where.trades = {
        some: { tradeId: filters.tradeId },
      };
    }

    if (filters.tag) {
      where.tags = {
        some: { label: { equals: filters.tag, mode: "insensitive" } },
      };
    }

    if (filters.usedOnSevaId) {
      where.sevas = {
        some: { sevaId: filters.usedOnSevaId },
      };
    }

    if (filters.hasValidInsurance) {
      where.credentials = {
        some: {
          kind: "INSURANCE",
          status: "VALID",
        },
      };
    }

    if (filters.credentialStatus) {
      where.credentials = {
        some: {
          status: filters.credentialStatus as any,
        },
      };
    }

    if (filters.expiringWithinDays !== undefined) {
      const horizon = new Date();
      horizon.setDate(horizon.getDate() + filters.expiringWithinDays);
      where.credentials = {
        some: {
          expiresAt: {
            lte: horizon,
            gte: new Date(),
          },
          status: { in: ["VALID", "EXPIRING_SOON"] },
        },
      };
    }

    if (filters.q) {
      const q = filters.q.trim();
      where.OR = [
        { companyName: { contains: q, mode: "insensitive" } },
        { tradingName: { contains: q, mode: "insensitive" } },
        { code: { contains: q, mode: "insensitive" } },
        { registrationNumber: { contains: q, mode: "insensitive" } },
        { mainEmail: { contains: q, mode: "insensitive" } },
        { mainPhone: { contains: q, mode: "insensitive" } },
        { contacts: { some: { name: { contains: q, mode: "insensitive" } } } },
        { contacts: { some: { phone: { contains: q, mode: "insensitive" } } } },
        { contacts: { some: { email: { contains: q, mode: "insensitive" } } } },
      ];
    }

    const orderBy: Prisma.ContractorOrderByWithRelationInput = {};
    if (filters.sortBy === "companyName") {
      orderBy.companyName = filters.sortOrder || "asc";
    } else if (filters.sortBy === "code") {
      orderBy.code = filters.sortOrder || "asc";
    } else {
      orderBy.createdAt = filters.sortOrder || "desc";
    }

    const [total, contractors] = await Promise.all([
      db.contractor.count({ where }),
      db.contractor.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          trades: {
            include: { trade: true },
          },
          contacts: {
            where: { isActive: true },
            orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
          },
          credentials: {
            select: {
              id: true,
              kind: true,
              type: true,
              issuer: true,
              number: true,
              coverAmount: true,
              issuedAt: true,
              expiresAt: true,
              status: true,
            },
          },
          tags: true,
          reviews: {
            where: { deletedAt: null },
            select: {
              rating: true,
              qualityRating: true,
              timelinessRating: true,
              priceRating: true,
              wouldUseAgain: true,
            },
          },
          sevas: {
            select: {
              id: true,
              sevaId: true,
              role: true,
              status: true,
              quotedAmount: true,
              finalAmount: true,
              seva: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  startDate: true,
                  dueDate: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Calculate rating averages and sanitize
    const sanitizedItems = contractors.map((c) => {
      const reviewCount = c.reviews.length;
      const avgRating =
        reviewCount > 0
          ? Number(
              (
                c.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount
              ).toFixed(1)
            )
          : null;

      // Filter out if ratingMin filter specified
      if (filters.ratingMin !== undefined && (avgRating === null || avgRating < filters.ratingMin)) {
        return null;
      }

      const itemWithStats = {
        ...c,
        avgRating,
        reviewCount,
      };

      return sanitizeContractor(itemWithStats, tierCtx);
    }).filter(Boolean);

    return {
      items: sanitizedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single contractor detail by ID with full relations and sanitized for user.
   */
  public static async getById(id: string, user?: AuthenticatedUser) {
    const tierCtx = user
      ? await getContractorTierContext(user)
      : { canReadFull: true, canViewCredentials: true, canViewDocuments: true, canViewRates: true };

    const contractor = await db.contractor.findUnique({
      where: { id },
      include: {
        trades: {
          include: { trade: true },
          orderBy: { isPrimary: "desc" },
        },
        contacts: {
          where: { isActive: true },
          orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
        },
        credentials: {
          orderBy: { createdAt: "desc" },
        },
        tags: true,
        reviews: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          include: {
            reviewedBy: {
              select: { id: true, name: true },
            },
            seva: {
              select: { id: true, code: true, title: true },
            },
          },
        },
        sevas: {
          orderBy: { createdAt: "desc" },
          include: {
            seva: {
              select: {
                id: true,
                code: true,
                title: true,
                startDate: true,
                dueDate: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    if (!contractor) {
      throw new AppError(404, "NOT_FOUND", "Contractor not found");
    }

    const c = contractor as any;

    // Compute review statistics
    const validReviews = c.reviews || [];
    const reviewCount = validReviews.length;
    const avgRating =
      reviewCount > 0
        ? Number(
            (
              validReviews.reduce((acc: number, r: any) => acc + r.rating, 0) / reviewCount
            ).toFixed(1)
          )
        : null;

    const wouldUseAgainCount = validReviews.filter((r: any) => r.wouldUseAgain).length;
    const wouldUseAgainPct =
      reviewCount > 0
        ? Math.round((wouldUseAgainCount / reviewCount) * 100)
        : null;

    // Financial spend aggregations for full access
    let totalQuoted = 0;
    let totalFinal = 0;
    let totalInvoiced = 0;
    for (const link of c.sevas) {
      if (link.quotedAmount) totalQuoted += Number(link.quotedAmount);
      if (link.finalAmount) totalFinal += Number(link.finalAmount);
      if (link.invoicedAmount) totalInvoiced += Number(link.invoicedAmount);
    }

    const payload = {
      ...c,
      avgRating,
      reviewCount,
      wouldUseAgainPct,
      spendTotals: {
        totalQuoted,
        totalFinal,
        totalInvoiced,
        jobsCount: c.sevas.length,
      },
    };

    return sanitizeContractor(payload, tierCtx);
  }

  /**
   * Create a new contractor.
   */
  public static async create(input: CreateContractorInput, userId: string) {
    const code = await generateContractorCode();

    const created = await db.$transaction(async (tx) => {
      const contractor = await tx.contractor.create({
        data: {
          code,
          companyName: input.companyName,
          tradingName: input.tradingName || null,
          registrationNumber: input.registrationNumber || null,
          registrationType: input.registrationType || "ABN",
          gstRegistered: input.gstRegistered ?? true,
          status: input.status || "ACTIVE",
          isPreferred: input.isPreferred ?? false,
          website: input.website || null,
          mainPhone: input.mainPhone || null,
          mainEmail: input.mainEmail || null,
          addressLine1: input.addressLine1 || null,
          addressLine2: input.addressLine2 || null,
          suburb: input.suburb || null,
          state: input.state || null,
          postcode: input.postcode || null,
          country: input.country || "AU",
          serviceAreas: input.serviceAreas || [],
          afterHoursAvailable: input.afterHoursAvailable ?? false,
          emergencyPhone: input.emergencyPhone || null,
          paymentTerms: input.paymentTerms || null,
          callOutFee: input.callOutFee !== undefined && input.callOutFee !== null ? new Prisma.Decimal(input.callOutFee) : null,
          hourlyRate: input.hourlyRate !== undefined && input.hourlyRate !== null ? new Prisma.Decimal(input.hourlyRate) : null,
          currency: input.currency || "AUD",
          internalNotes: input.internalNotes || null,
          createdById: userId,
        },
      });

      // Insert trades
      if (input.tradeIds && input.tradeIds.length > 0) {
        await tx.contractorTrade.createMany({
          data: input.tradeIds.map((tradeId, idx) => ({
            contractorId: contractor.id,
            tradeId,
            isPrimary: input.primaryTradeId ? tradeId === input.primaryTradeId : idx === 0,
          })),
        });
      }

      // Insert contacts
      if (input.contacts && input.contacts.length > 0) {
        await tx.contractorContact.createMany({
          data: input.contacts.map((c, idx) => ({
            contractorId: contractor.id,
            name: c.name,
            jobTitle: c.jobTitle || null,
            phone: c.phone || null,
            mobile: c.mobile || null,
            email: c.email || null,
            isPrimary: c.isPrimary ?? idx === 0,
            notes: c.notes || null,
            isActive: c.isActive ?? true,
          })),
        });
      }

      // Insert tags
      if (input.tags && input.tags.length > 0) {
        await tx.contractorTag.createMany({
          data: input.tags.map((label) => ({
            contractorId: contractor.id,
            label,
          })),
          skipDuplicates: true,
        });
      }

      return contractor;
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: created.id,
      userId,
      action: "CREATE_CONTRACTOR",
      newValue: { code: created.code, companyName: created.companyName },
    });

    return created;
  }

  /**
   * Update an existing contractor with optimistic concurrency locking.
   */
  public static async update(
    id: string,
    input: UpdateContractorInput & { expectedVersion?: number },
    expectedVersionOrUserId: number | string,
    maybeUserId?: string
  ) {
    let expectedVersion: number;
    let userId: string;

    if (typeof expectedVersionOrUserId === "number") {
      expectedVersion = expectedVersionOrUserId;
      userId = maybeUserId || "system";
    } else {
      expectedVersion = input.expectedVersion ?? 1;
      userId = expectedVersionOrUserId;
    }
    const existing = await db.contractor.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new AppError(404, "NOT_FOUND", "Contractor not found");
    }

    if (existing.version !== expectedVersion) {
      throw new AppError(
        409,
        "CONFLICT",
        `Contractor has been modified by another process. Expected version ${expectedVersion}, but found ${existing.version}. Please reload and retry.`
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const data: Prisma.ContractorUpdateInput = {
        version: { increment: 1 },
      };

      if (input.companyName !== undefined) data.companyName = input.companyName;
      if (input.tradingName !== undefined) data.tradingName = input.tradingName;
      if (input.registrationNumber !== undefined) data.registrationNumber = input.registrationNumber;
      if (input.registrationType !== undefined) data.registrationType = input.registrationType;
      if (input.gstRegistered !== undefined) data.gstRegistered = input.gstRegistered;
      if (input.status !== undefined) data.status = input.status;
      if (input.isPreferred !== undefined) data.isPreferred = input.isPreferred;
      if (input.website !== undefined) data.website = input.website;
      if (input.mainPhone !== undefined) data.mainPhone = input.mainPhone;
      if (input.mainEmail !== undefined) data.mainEmail = input.mainEmail;
      if (input.addressLine1 !== undefined) data.addressLine1 = input.addressLine1;
      if (input.addressLine2 !== undefined) data.addressLine2 = input.addressLine2;
      if (input.suburb !== undefined) data.suburb = input.suburb;
      if (input.state !== undefined) data.state = input.state;
      if (input.postcode !== undefined) data.postcode = input.postcode;
      if (input.country !== undefined) data.country = input.country;
      if (input.serviceAreas !== undefined) data.serviceAreas = input.serviceAreas;
      if (input.afterHoursAvailable !== undefined) data.afterHoursAvailable = input.afterHoursAvailable;
      if (input.emergencyPhone !== undefined) data.emergencyPhone = input.emergencyPhone;
      if (input.paymentTerms !== undefined) data.paymentTerms = input.paymentTerms;
      if (input.callOutFee !== undefined) {
        data.callOutFee = input.callOutFee !== null ? new Prisma.Decimal(input.callOutFee) : null;
      }
      if (input.hourlyRate !== undefined) {
        data.hourlyRate = input.hourlyRate !== null ? new Prisma.Decimal(input.hourlyRate) : null;
      }
      if (input.currency !== undefined) data.currency = input.currency;
      if (input.internalNotes !== undefined) data.internalNotes = input.internalNotes;

      const res = await tx.contractor.update({
        where: { id },
        data,
      });

      // Update trades if provided
      if (input.tradeIds !== undefined) {
        await tx.contractorTrade.deleteMany({ where: { contractorId: id } });
        if (input.tradeIds.length > 0) {
          await tx.contractorTrade.createMany({
            data: input.tradeIds.map((tradeId, idx) => ({
              contractorId: id,
              tradeId,
              isPrimary: input.primaryTradeId ? tradeId === input.primaryTradeId : idx === 0,
            })),
          });
        }
      }

      // Update tags if provided
      if (input.tags !== undefined) {
        await tx.contractorTag.deleteMany({ where: { contractorId: id } });
        if (input.tags.length > 0) {
          await tx.contractorTag.createMany({
            data: input.tags.map((label) => ({
              contractorId: id,
              label,
            })),
            skipDuplicates: true,
          });
        }
      }

      return res;
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: id,
      userId,
      action: "UPDATE_CONTRACTOR",
      oldValue: { version: existing.version },
      newValue: { version: updated.version, changes: input },
    });

    return updated;
  }

  /**
   * Soft-archive a contractor.
   */
  public static async archive(id: string, userId: string) {
    const contractor = await db.contractor.findUnique({ where: { id } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const updated = await db.contractor.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: id,
      userId,
      action: "ARCHIVE_CONTRACTOR",
      newValue: { archivedAt: updated.archivedAt },
    });

    return updated;
  }

  /**
   * Unarchive a contractor.
   */
  public static async unarchive(id: string, userId: string) {
    const contractor = await db.contractor.findUnique({ where: { id } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const updated = await db.contractor.update({
      where: { id },
      data: { archivedAt: null },
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: id,
      userId,
      action: "UNARCHIVE_CONTRACTOR",
      newValue: { archivedAt: null },
    });

    return updated;
  }

  /**
   * Block a contractor (requires reason, notifies coordinators).
   */
  public static async block(id: string, reason: string, userId: string) {
    const contractor = await db.contractor.findUnique({ where: { id } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const updated = await db.contractor.update({
      where: { id },
      data: {
        status: "BLOCKED",
        blockedReason: reason,
        version: { increment: 1 },
      },
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: id,
      userId,
      action: "BLOCK_CONTRACTOR",
      newValue: { status: "BLOCKED", blockedReason: reason },
    });

    // Notify coordinators and admins
    const coordinators = await db.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "COORDINATOR"] } },
        isActive: true,
      },
      select: { id: true },
    });

    if (coordinators.length > 0) {
      await db.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.id,
          type: "CONTRACTOR_BLOCKED",
          title: `Contractor Blocked: ${contractor.companyName}`,
          body: `Reason: ${reason}`,
          entityType: "CONTRACTOR",
          entityId: contractor.id,
          linkUrl: `/contractors/${contractor.id}`,
        })),
      });
    }

    return updated;
  }

  /**
   * Unblock a contractor.
   */
  public static async unblock(id: string, userId: string) {
    const contractor = await db.contractor.findUnique({ where: { id } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const updated = await db.contractor.update({
      where: { id },
      data: {
        status: "ACTIVE",
        blockedReason: null,
        version: { increment: 1 },
      },
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: id,
      userId,
      action: "UNBLOCK_CONTRACTOR",
      newValue: { status: "ACTIVE" },
    });

    // Notify coordinators and admins
    const coordinators = await db.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "COORDINATOR"] } },
        isActive: true,
      },
      select: { id: true },
    });

    if (coordinators.length > 0) {
      await db.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.id,
          type: "CONTRACTOR_UNBLOCKED",
          title: `Contractor Unblocked: ${contractor.companyName}`,
          body: `Contractor has been restored to active status.`,
          entityType: "CONTRACTOR",
          entityId: contractor.id,
          linkUrl: `/contractors/${contractor.id}`,
        })),
      });
    }

    return updated;
  }

  /**
   * Update trades linked to contractor.
   */
  public static async setTrades(
    id: string,
    trades: Array<{ tradeId: string; isPrimary?: boolean }>,
    userId: string
  ) {
    const contractor = await db.contractor.findUnique({ where: { id } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    await db.$transaction(async (tx) => {
      await tx.contractorTrade.deleteMany({ where: { contractorId: id } });
      if (trades.length > 0) {
        await tx.contractorTrade.createMany({
          data: trades.map((t) => ({
            contractorId: id,
            tradeId: t.tradeId,
            isPrimary: t.isPrimary ?? false,
          })),
        });
      }
    });

    await logAudit({
      entityType: "CONTRACTOR",
      entityId: id,
      userId,
      action: "UPDATE_CONTRACTOR_TRADES",
      newValue: { trades },
    });

    return { success: true };
  }
}
