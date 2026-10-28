import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { SevaContractorRole, SevaContractorStatus, Prisma } from "@prisma/client";
import { LinkSevaContractorInput, UpdateSevaContractorInput } from "./schemas";
import { AuthenticatedUser } from "@/core/permissions/can";
import { sanitizeSevaContractor, getContractorTierContext } from "./tiers";

export class SevaContractorService {
  /**
   * List contractors linked to a seva task, sanitized for caller permissions.
   */
  public static async listForSeva(sevaId: string, user: AuthenticatedUser) {
    const tierCtx = await getContractorTierContext(user);

    const links = await db.sevaContractor.findMany({
      where: { sevaId },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
      include: {
        contractor: {
          include: {
            trades: { include: { trade: true } },
            contacts: { where: { isPrimary: true } },
            credentials: {
              select: {
                id: true,
                kind: true,
                type: true,
                status: true,
                expiresAt: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true },
        },
      },
    });

    return links.map((link) => sanitizeSevaContractor(link, tierCtx));
  }

  /**
   * Check warnings for a contractor: BLOCKED, EXPIRED or missing insurance/licence.
   */
  public static async checkContractorWarnings(contractorId: string) {
    const contractor = await db.contractor.findUnique({
      where: { id: contractorId },
      include: {
        credentials: true,
      },
    });

    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const warnings: string[] = [];

    if (contractor.status === "BLOCKED") {
      warnings.push(`Contractor is BLOCKED. Reason: ${contractor.blockedReason || "Unspecified"}`);
    } else if (contractor.status !== "ACTIVE") {
      warnings.push(`Contractor is currently ${contractor.status}`);
    }

    const insurance = contractor.credentials.filter((c) => c.kind === "INSURANCE");
    if (insurance.length === 0) {
      warnings.push("Contractor has no insurance credentials on record");
    } else {
      const validInsurance = insurance.some((c) => c.status === "VALID" || c.status === "EXPIRING_SOON");
      if (!validInsurance) {
        warnings.push("Contractor's insurance credential is EXPIRED or REVOKED");
      }
    }

    const licences = contractor.credentials.filter((c) => c.kind === "LICENCE");
    if (licences.length > 0) {
      const validLicences = licences.some((c) => c.status === "VALID" || c.status === "EXPIRING_SOON");
      if (!validLicences) {
        warnings.push("Contractor's licence credential is EXPIRED or REVOKED");
      }
    }

    return {
      hasWarnings: warnings.length > 0,
      warnings,
      contractor,
    };
  }

  /**
   * Link contractor to seva task with warning confirmation enforcement.
   */
  public static async linkContractor(
    sevaId: string,
    input: LinkSevaContractorInput,
    userId: string
  ) {
    const seva = await db.seva.findUnique({ where: { id: sevaId } });
    if (!seva) throw new AppError(404, "NOT_FOUND", "Seva task not found");

    const check = await this.checkContractorWarnings(input.contractorId);
    if (check.hasWarnings && !input.confirmWarning) {
      throw new AppError(
        400,
        "CONTRACTOR_WARNING_REQUIRED",
        "Contractor has safety or compliance warnings that must be confirmed before linking.",
        { warnings: check.warnings }
      );
    }

    const engagedAt = input.status === "ENGAGED" ? new Date() : null;

    const link = await db.sevaContractor.upsert({
      where: {
        sevaId_contractorId_role: {
          sevaId,
          contractorId: input.contractorId,
          role: input.role as SevaContractorRole,
        },
      },
      create: {
        sevaId,
        contractorId: input.contractorId,
        role: input.role as SevaContractorRole,
        scope: input.scope || null,
        status: input.status ? (input.status as SevaContractorStatus) : "INVITED",
        quotedAmount: input.quotedAmount !== undefined && input.quotedAmount !== null ? new Prisma.Decimal(input.quotedAmount) : null,
        finalAmount: input.finalAmount !== undefined && input.finalAmount !== null ? new Prisma.Decimal(input.finalAmount) : null,
        invoiceNumber: input.invoiceNumber || null,
        invoicedAmount: input.invoicedAmount !== undefined && input.invoicedAmount !== null ? new Prisma.Decimal(input.invoicedAmount) : null,
        invoicedAt: input.invoicedAt ? new Date(input.invoicedAt) : null,
        paidAt: input.paidAt ? new Date(input.paidAt) : null,
        engagedAt,
        createdById: userId,
      },
      update: {
        scope: input.scope !== undefined ? input.scope : undefined,
        status: input.status ? (input.status as SevaContractorStatus) : undefined,
        quotedAmount: input.quotedAmount !== undefined ? (input.quotedAmount !== null ? new Prisma.Decimal(input.quotedAmount) : null) : undefined,
        finalAmount: input.finalAmount !== undefined ? (input.finalAmount !== null ? new Prisma.Decimal(input.finalAmount) : null) : undefined,
        invoiceNumber: input.invoiceNumber !== undefined ? input.invoiceNumber : undefined,
        invoicedAmount: input.invoicedAmount !== undefined ? (input.invoicedAmount !== null ? new Prisma.Decimal(input.invoicedAmount) : null) : undefined,
        invoicedAt: input.invoicedAt !== undefined ? (input.invoicedAt ? new Date(input.invoicedAt) : null) : undefined,
        paidAt: input.paidAt !== undefined ? (input.paidAt ? new Date(input.paidAt) : null) : undefined,
        engagedAt: input.status === "ENGAGED" && !engagedAt ? new Date() : undefined,
      },
      include: {
        contractor: true,
      },
    });

    await logAudit({
      entityType: "SEVA_CONTRACTOR",
      entityId: link.id,
      userId,
      action: "LINK_SEVA_CONTRACTOR",
      newValue: {
        sevaId,
        contractorId: input.contractorId,
        role: input.role,
        status: link.status,
        warningsConfirmed: check.hasWarnings ? check.warnings : null,
      },
    });

    // Notify assigned users or watchers of seva that contractor was linked
    const assignees = await db.sevaAssignee.findMany({
      where: { sevaId },
      select: { userId: true },
    });
    const watchers = await db.sevaWatcher.findMany({
      where: { sevaId },
      select: { userId: true },
    });
    const recipientIds = Array.from(new Set([...assignees.map((a) => a.userId), ...watchers.map((w) => w.userId)]))
      .filter((id) => id !== userId);

    if (recipientIds.length > 0) {
      await db.notification.createMany({
        data: recipientIds.map((rId) => ({
          userId: rId,
          type: "SEVA_CONTRACTOR_LINKED",
          title: `Contractor Added to Seva: ${seva.title}`,
          body: `${check.contractor.companyName} (${link.role}) added to task`,
          entityType: "SEVA",
          entityId: sevaId,
          linkUrl: `/seva/${sevaId}`,
        })),
      });
    }

    return link;
  }

  /**
   * Update existing SevaContractor link.
   */
  public static async updateLink(id: string, input: UpdateSevaContractorInput, userId: string) {
    const existing = await db.sevaContractor.findUnique({
      where: { id },
      include: { contractor: true },
    });

    if (!existing) throw new AppError(404, "NOT_FOUND", "Seva contractor link not found");

    if (input.status === "ENGAGED" && existing.status !== "ENGAGED") {
      const check = await this.checkContractorWarnings(existing.contractorId);
      if (check.hasWarnings && !input.confirmWarning) {
        throw new AppError(
          400,
          "CONTRACTOR_WARNING_REQUIRED",
          "Contractor has warnings that must be confirmed to mark as ENGAGED.",
          { warnings: check.warnings }
        );
      }
    }

    const data: Prisma.SevaContractorUpdateInput = {
      ...(input.role !== undefined ? { role: input.role as SevaContractorRole } : {}),
      ...(input.scope !== undefined ? { scope: input.scope } : {}),
      ...(input.status !== undefined ? { status: input.status as SevaContractorStatus } : {}),
      ...(input.quotedAmount !== undefined
        ? { quotedAmount: input.quotedAmount !== null ? new Prisma.Decimal(input.quotedAmount) : null }
        : {}),
      ...(input.finalAmount !== undefined
        ? { finalAmount: input.finalAmount !== null ? new Prisma.Decimal(input.finalAmount) : null }
        : {}),
      ...(input.invoiceNumber !== undefined ? { invoiceNumber: input.invoiceNumber } : {}),
      ...(input.invoicedAmount !== undefined
        ? { invoicedAmount: input.invoicedAmount !== null ? new Prisma.Decimal(input.invoicedAmount) : null }
        : {}),
      ...(input.invoicedAt !== undefined
        ? { invoicedAt: input.invoicedAt ? new Date(input.invoicedAt) : null }
        : {}),
      ...(input.paidAt !== undefined
        ? { paidAt: input.paidAt ? new Date(input.paidAt) : null }
        : {}),
    };

    if (input.status === "ENGAGED" && !existing.engagedAt) {
      data.engagedAt = new Date();
    }
    if (input.status === "COMPLETED" && !existing.completedAt) {
      data.completedAt = new Date();
    }

    const updated = await db.sevaContractor.update({
      where: { id },
      data,
    });

    await logAudit({
      entityType: "SEVA_CONTRACTOR",
      entityId: id,
      userId,
      action: "UPDATE_SEVA_CONTRACTOR",
      oldValue: { status: existing.status },
      newValue: { status: updated.status, changes: input },
    });

    return updated;
  }

  /**
   * Remove contractor link from seva.
   */
  public static async removeLink(id: string, userId: string) {
    const existing = await db.sevaContractor.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Link not found");

    const deleted = await db.sevaContractor.delete({ where: { id } });

    await logAudit({
      entityType: "SEVA_CONTRACTOR",
      entityId: id,
      userId,
      action: "REMOVE_SEVA_CONTRACTOR",
      oldValue: { sevaId: existing.sevaId, contractorId: existing.contractorId },
    });

    return deleted;
  }

  /**
   * Get suggestions for a Seva task based on CategoryTrade mappings,
   * ranked by preferred, rating, active status, and valid insurance.
   */
  public static async getSuggestions(sevaId: string) {
    const seva = await db.seva.findUnique({
      where: { id: sevaId },
      select: { categoryId: true },
    });

    if (!seva) throw new AppError(404, "NOT_FOUND", "Seva not found");

    // Find trade IDs mapped to this category
    const categoryTrades = await db.categoryTrade.findMany({
      where: { categoryId: seva.categoryId },
      select: { tradeId: true },
    });

    const tradeIds = categoryTrades.map((ct) => ct.tradeId);

    // Fetch contractors in these trades or all active contractors if no mapping
    const where: Prisma.ContractorWhereInput = {
      archivedAt: null,
      status: "ACTIVE",
    };

    if (tradeIds.length > 0) {
      where.trades = {
        some: { tradeId: { in: tradeIds } },
      };
    }

    const contractors = await db.contractor.findMany({
      where,
      take: 20,
      include: {
        trades: { include: { trade: true } },
        contacts: { where: { isPrimary: true } },
        credentials: {
          where: { kind: "INSURANCE" },
        },
        reviews: {
          where: { deletedAt: null },
          select: { rating: true },
        },
      },
    });

    // Score and rank contractors
    const scored = contractors.map((c) => {
      let score = 0;
      if (c.isPreferred) score += 50;

      const hasValidInsurance = c.credentials.some(
        (cred) => cred.status === "VALID" || cred.status === "EXPIRING_SOON"
      );
      if (hasValidInsurance) score += 30;

      const reviewCount = c.reviews.length;
      const avgRating =
        reviewCount > 0
          ? c.reviews.reduce((acc, r) => acc + r.rating, 0) / reviewCount
          : 0;

      score += avgRating * 4; // up to 20 points

      return {
        id: c.id,
        code: c.code,
        companyName: c.companyName,
        tradingName: c.tradingName,
        isPreferred: c.isPreferred,
        suburb: c.suburb,
        state: c.state,
        mainPhone: c.mainPhone,
        mainEmail: c.mainEmail,
        primaryContact: c.contacts[0] || null,
        trades: c.trades.map((t) => t.trade.name),
        avgRating: reviewCount > 0 ? Number(avgRating.toFixed(1)) : null,
        reviewCount,
        hasValidInsurance,
        matchScore: score,
      };
    });

    scored.sort((a, b) => b.matchScore - a.matchScore);

    return scored;
  }

  /**
   * Admin tool: suggest quote matches for unlinked quotes based on supplier name trigram similarity.
   */
  public static async suggestQuoteMatches() {
    const unlinkedQuotes = await db.sevaFile.findMany({
      where: {
        bucket: "QUOTE",
        contractorId: null,
        supplierName: { not: null },
        deletedAt: null,
      },
      include: {
        seva: { select: { id: true, code: true, title: true } },
      },
    });

    const suggestions: Array<{
      quoteFileId: string;
      sevaId: string;
      sevaCode: string;
      sevaTitle: string;
      supplierName: string;
      quoteAmount: number | null;
      matches: Array<{
        contractorId: string;
        code: string;
        companyName: string;
        similarity: number;
      }>;
    }> = [];

    for (const quote of unlinkedQuotes) {
      if (!quote.supplierName || quote.supplierName.trim().length === 0) continue;

      const matches = await db.$queryRaw<
        Array<{
          id: string;
          code: string;
          company_name: string;
          sim: number;
        }>
      >(Prisma.sql`
        SELECT id, code, company_name, GREATEST(similarity(company_name, ${quote.supplierName}), similarity(COALESCE(trading_name, ''), ${quote.supplierName})) as sim
        FROM contractors
        WHERE archived_at IS NULL
          AND (company_name % ${quote.supplierName} OR trading_name % ${quote.supplierName} OR similarity(company_name, ${quote.supplierName}) > 0.4)
        ORDER BY sim DESC
        LIMIT 3
      `);

      if (matches.length > 0) {
        suggestions.push({
          quoteFileId: quote.id,
          sevaId: quote.seva.id,
          sevaCode: quote.seva.code,
          sevaTitle: quote.seva.title,
          supplierName: quote.supplierName,
          quoteAmount: quote.amount ? Number(quote.amount) : null,
          matches: matches.map((m) => ({
            contractorId: m.id,
            code: m.code,
            companyName: m.company_name,
            similarity: Number(m.sim.toFixed(2)),
          })),
        });
      }
    }

    return suggestions;
  }

  /**
   * Link an existing quote to a contractor upon explicit admin confirmation.
   */
  public static async linkQuoteToContractor(quoteFileId: string, contractorId: string, userId: string) {
    const quote = await db.sevaFile.findUnique({ where: { id: quoteFileId } });
    if (!quote) throw new AppError(404, "NOT_FOUND", "Quote file not found");

    const contractor = await db.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const updated = await db.sevaFile.update({
      where: { id: quoteFileId },
      data: { contractorId },
    });

    await logAudit({
      entityType: "SEVA_FILE",
      entityId: quoteFileId,
      userId,
      action: "LINK_QUOTE_TO_CONTRACTOR",
      newValue: { contractorId, contractorCode: contractor.code },
    });

    return updated;
  }
}
