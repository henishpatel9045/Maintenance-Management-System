import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { generateContractorRequestCode, generateContractorCode } from "./code";
import { ContractorRequestStatus, ContractorRequestType, Prisma } from "@prisma/client";
import {
  CreateContractorRequestInput,
  ApproveContractorRequestInput,
  RejectContractorRequestInput,
  RequestMoreInfoInput,
} from "./schemas";
import { AuthenticatedUser, can } from "@/core/permissions/can";

function extractTradeEntries(rawTrades: unknown): { tradeId: string; isPrimary: boolean }[] {
  if (!Array.isArray(rawTrades)) return [];
  const entries: { tradeId: string; isPrimary: boolean }[] = [];
  for (let idx = 0; idx < rawTrades.length; idx++) {
    const t = rawTrades[idx];
    let tradeId: string | undefined;
    let isPrimary = idx === 0;

    if (typeof t === "string" && t.trim()) {
      tradeId = t.trim();
    } else if (typeof t === "object" && t !== null) {
      const rawId = (t as any).tradeId || (t as any).id || (t as any).value;
      if (typeof rawId === "string" && rawId.trim()) {
        tradeId = rawId.trim();
      }
      if (typeof (t as any).isPrimary === "boolean") {
        isPrimary = (t as any).isPrimary;
      }
    }

    if (tradeId && !entries.some((e) => e.tradeId === tradeId)) {
      entries.push({ tradeId, isPrimary });
    }
  }
  return entries;
}

export class RequestService {
  public static create = RequestService.submit;

  /**
   * Helper to retrieve side-by-side comparison object for reviews/testing.
   */
  public static async getComparison(id: string) {
    const adminUser: AuthenticatedUser = {
      id: "admin",
      role: "ADMIN",
      permissions: new Set(["*"]),
      isActive: true,
      email: "admin@seva.local",
      name: "Admin",
    };
    const res = await this.getByIdWithDiff(id, adminUser);
    const differences: Array<{ field: string; currentValue: any; proposedValue: any; changed: boolean }> = [];
    if (res.diff) {
      for (const [field, data] of Object.entries(res.diff)) {
        differences.push({
          field,
          currentValue: data.current,
          proposedValue: data.proposed,
          changed: data.changed,
        });
      }
    }
    return {
      request: res.request,
      differences,
      diff: res.diff,
      versionConflict: res.versionConflict,
    };
  }

  /**
   * Submit a new contractor request (Suggest New Contractor or Suggest Change).
   */
  public static async submit(input: CreateContractorRequestInput, userId: string) {
    // 1. Check quotas from settings
    const [maxOpenSetting, maxDailySetting] = await Promise.all([
      db.setting.findUnique({ where: { key: "contractorRequestMaxOpenPerUser" } }),
      db.setting.findUnique({ where: { key: "contractorRequestMaxPerDay" } }),
    ]);

    const maxOpen = typeof maxOpenSetting?.value === "number" ? maxOpenSetting.value : 5;
    const maxDaily = typeof maxDailySetting?.value === "number" ? maxDailySetting.value : 10;

    // Check open requests count for user
    const openCount = await db.contractorRequest.count({
      where: { requestedById: userId, status: "OPEN" },
    });
    if (openCount >= maxOpen) {
      throw new AppError(
        429,
        "REQUEST_LIMIT_REACHED",
        `You have reached the maximum allowed open requests (${maxOpen}). Please wait for existing requests to be reviewed.`
      );
    }

    // Check 24-hour daily limit
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dailyCount = await db.contractorRequest.count({
      where: { requestedById: userId, createdAt: { gte: dayAgo } },
    });
    if (dailyCount >= maxDaily) {
      throw new AppError(
        429,
        "DAILY_LIMIT_REACHED",
        `You have submitted the maximum allowed requests for today (${maxDaily}). Please try again tomorrow.`
      );
    }

    // 2. Validate target contractor if UPDATE_CONTRACTOR
    let initialContractorVersion: number | null = null;
    if (input.type === "UPDATE_CONTRACTOR") {
      if (!input.contractorId) {
        throw new AppError(400, "BAD_REQUEST", "contractorId is required for update requests");
      }
      const target = await db.contractor.findUnique({
        where: { id: input.contractorId },
        select: { id: true, version: true, archivedAt: true },
      });
      if (!target || target.archivedAt) {
        throw new AppError(404, "NOT_FOUND", "Target contractor not found or archived");
      }
      initialContractorVersion = target.version;
    }

    // 3. Generate unique request code
    const code = await generateContractorRequestCode();

    // 4. Store request
    // Include contractorVersionSnapshot inside proposedData for conflict detection
    const proposedDataWithVersion = {
      ...(input.proposedData as Record<string, unknown>),
      _initialContractorVersion: initialContractorVersion,
    };

    const request = await db.contractorRequest.create({
      data: {
        code,
        type: input.type as ContractorRequestType,
        contractorId: input.contractorId || null,
        proposedData: proposedDataWithVersion as any,
        note: input.note || null,
        requestedById: userId,
        status: "OPEN",
      },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_REQUEST",
      entityId: request.id,
      userId,
      action: "SUBMIT_CONTRACTOR_REQUEST",
      newValue: {
        code: request.code,
        type: request.type,
        contractorId: request.contractorId,
      },
    });

    // 5. Notify coordinators and admins (users with requests.review)
    const reviewers = await db.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "COORDINATOR"] } },
        isActive: true,
      },
      select: { id: true },
    });

    if (reviewers.length > 0) {
      await db.notification.createMany({
        data: reviewers.map((r) => ({
          userId: r.id,
          type: "NEW_CONTRACTOR_REQUEST",
          title: `New Contractor Request: ${request.code}`,
          body: `Submitted by ${request.requestedBy.name} (${input.type === "NEW_CONTRACTOR" ? "New Contractor" : "Update Suggestion"})`,
          entityType: "CONTRACTOR_REQUEST",
          entityId: request.id,
          linkUrl: `/contractors/requests/${request.id}`,
        })),
      });
    }

    return request;
  }

  /**
   * List requests submitted by current user.
   */
  public static async listMine(userId: string) {
    return db.contractorRequest.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "desc" },
      include: {
        targetContractor: {
          select: { id: true, code: true, companyName: true },
        },
        resultingContractor: {
          select: { id: true, code: true, companyName: true },
        },
      },
    });
  }

  /**
   * List review queue for reviewers.
   */
  public static async listQueue(filters: {
    status?: ContractorRequestStatus;
    type?: ContractorRequestType;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(100, Math.max(1, filters.limit || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ContractorRequestWhereInput = {};
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.type) {
      where.type = filters.type;
    }

    const [total, items] = await Promise.all([
      db.contractorRequest.count({ where }),
      db.contractorRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          reviewedBy: {
            select: { id: true, name: true },
          },
          targetContractor: {
            select: { id: true, code: true, companyName: true, status: true },
          },
          resultingContractor: {
            select: { id: true, code: true, companyName: true },
          },
        },
      }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single request with side-by-side comparison against current contractor.
   */
  public static async getByIdWithDiff(id: string, user: AuthenticatedUser) {
    const request = await db.contractorRequest.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
        targetContractor: {
          include: {
            trades: { include: { trade: true } },
            contacts: { where: { isActive: true } },
            tags: true,
          },
        },
        resultingContractor: {
          select: { id: true, code: true, companyName: true },
        },
      },
    });

    if (!request) {
      throw new AppError(404, "NOT_FOUND", "Contractor request not found");
    }

    // Check ownership if user lacks review permission
    const isReviewer = can(user, "contractors.requests.review");
    if (!isReviewer && request.requestedById !== user.id) {
      throw new AppError(403, "FORBIDDEN", "You can only view your own requests");
    }

    // Fetch supporting files attached to this request
    const files = await db.fileLink.findMany({
      where: {
        entityType: "CONTRACTOR_REQUEST",
        entityId: id,
      },
      include: {
        fileObject: true,
      },
    });

    // Compute diff for UPDATE_CONTRACTOR
    let diff: Record<string, { current: unknown; proposed: unknown; changed: boolean }> | null = null;
    let versionConflict = false;

    if (request.type === "UPDATE_CONTRACTOR" && request.targetContractor) {
      const target = request.targetContractor;
      const proposed = (request.proposedData || {}) as Record<string, any>;
      const initialVer = proposed._initialContractorVersion;

      if (initialVer !== undefined && target.version !== initialVer) {
        versionConflict = true;
      }

      diff = {};
      const fieldsToCompare = [
        "companyName",
        "tradingName",
        "registrationNumber",
        "registrationType",
        "website",
        "mainPhone",
        "mainEmail",
        "addressLine1",
        "addressLine2",
        "suburb",
        "state",
        "postcode",
        "country",
        "afterHoursAvailable",
        "emergencyPhone",
        "paymentTerms",
      ];

      for (const field of fieldsToCompare) {
        const currentVal = (target as any)[field];
        const proposedVal = proposed[field];
        if (proposedVal !== undefined) {
          diff[field] = {
            current: currentVal,
            proposed: proposedVal,
            changed: JSON.stringify(currentVal) !== JSON.stringify(proposedVal),
          };
        }
      }

      // Trades comparison
      if (proposed.trades !== undefined) {
        const currentTradeIds = target.trades.map((t) => t.tradeId).sort();
        const rawProposed = Array.isArray(proposed.trades) ? proposed.trades : [];
        const proposedEntries = extractTradeEntries(rawProposed);
        const proposedTradeIds = proposedEntries.map((e) => e.tradeId).sort();

        // Fetch trade names for proposed trades
        const tradeRecords = await db.trade.findMany({
          where: { id: { in: proposedTradeIds } },
          select: { id: true, name: true },
        });
        const tradeMap = new Map(tradeRecords.map((tr) => [tr.id, tr.name]));

        const normalizedProposed = proposedEntries.map((e) => ({
          tradeId: e.tradeId,
          name: tradeMap.get(e.tradeId) || e.tradeId,
          isPrimary: e.isPrimary,
        }));

        diff["trades"] = {
          current: target.trades.map((t) => ({ tradeId: t.tradeId, name: t.trade.name, isPrimary: t.isPrimary })),
          proposed: normalizedProposed,
          changed: JSON.stringify(currentTradeIds) !== JSON.stringify(proposedTradeIds),
        };
      }
    }

    return {
      request,
      files,
      diff,
      versionConflict,
    };
  }

  /**
   * Approve a request: applies changes to Contractor in a single transaction,
   * writes audit log with both requester and reviewer, and notifies requester.
   */
  public static async approve(
    id: string,
    input: ApproveContractorRequestInput,
    reviewerUserOrId: AuthenticatedUser | string
  ) {
    const reviewerUser: AuthenticatedUser =
      typeof reviewerUserOrId === "string"
        ? {
            id: reviewerUserOrId,
            role: "ADMIN",
            permissions: new Set(["*"]),
            isActive: true,
            email: "admin@seva.local",
            name: "Admin",
          }
        : reviewerUserOrId;

    const request = await db.contractorRequest.findUnique({
      where: { id },
      include: {
        requestedBy: true,
        targetContractor: true,
      },
    });

    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found");
    if (request.status !== "OPEN") {
      throw new AppError(400, "BAD_REQUEST", `Cannot approve request with status ${request.status}`);
    }

    const proposed = (request.proposedData || {}) as Record<string, any>;

    // Handle Optimistic Locking Conflict for UPDATE requests
    if (request.type === "UPDATE_CONTRACTOR") {
      if (!request.targetContractor) {
        throw new AppError(404, "NOT_FOUND", "Target contractor not found");
      }

      const initialVer = proposed._initialContractorVersion;
      if (
        initialVer !== undefined &&
        request.targetContractor.version !== initialVer &&
        !input.confirmConflict
      ) {
        throw new AppError(
          409,
          "VERSION_CONFLICT",
          "The contractor was modified after this request was submitted. Please review the updated contractor details and confirm to proceed.",
          {
            currentVersion: request.targetContractor.version,
            snapshotVersion: initialVer,
          }
        );
      }
    }

    const result = await db.$transaction(async (tx) => {
      let resultingContractorId: string;
      const isPartial =
        input.acceptedFields &&
        input.acceptedFields.length > 0 &&
        proposed &&
        Object.keys(proposed).filter((k) => !k.startsWith("_")).some(
          (k) => !input.acceptedFields!.includes(k)
        );

      const finalStatus: ContractorRequestStatus = isPartial ? "PARTIALLY_APPROVED" : "APPROVED";

      if (request.type === "NEW_CONTRACTOR") {
        // Create new contractor using proposed data overridden by reviewer's editedData
        const mergedData = { ...proposed, ...(input.editedData || {}) };
        const code = await generateContractorCode();

        const newContractor = await tx.contractor.create({
          data: {
            code,
            companyName: mergedData.companyName,
            tradingName: mergedData.tradingName || null,
            registrationNumber: mergedData.registrationNumber || null,
            registrationType: mergedData.registrationType || "ABN",
            gstRegistered: mergedData.gstRegistered ?? true,
            status: "ACTIVE",
            isPreferred: mergedData.isPreferred ?? false,
            website: mergedData.website || null,
            mainPhone: mergedData.mainPhone || null,
            mainEmail: mergedData.mainEmail || null,
            addressLine1: mergedData.addressLine1 || null,
            addressLine2: mergedData.addressLine2 || null,
            suburb: mergedData.suburb || null,
            state: mergedData.state || null,
            postcode: mergedData.postcode || null,
            country: mergedData.country || "AU",
            serviceAreas: mergedData.serviceAreas || [],
            afterHoursAvailable: mergedData.afterHoursAvailable ?? false,
            emergencyPhone: mergedData.emergencyPhone || null,
            paymentTerms: mergedData.paymentTerms || null,
            currency: "AUD",
            internalNotes: mergedData.internalNotes || null,
            createdById: reviewerUser.id,
          },
        });

        resultingContractorId = newContractor.id;

        // Insert trades
        if (mergedData.trades && Array.isArray(mergedData.trades)) {
          const tradeEntries = extractTradeEntries(mergedData.trades);
          if (tradeEntries.length > 0) {
            const existingTrades = await tx.trade.findMany({
              where: { id: { in: tradeEntries.map((e) => e.tradeId) } },
              select: { id: true },
            });
            const validIds = new Set(existingTrades.map((et) => et.id));
            const validEntries = tradeEntries.filter((e) => validIds.has(e.tradeId));

            if (validEntries.length > 0) {
              await tx.contractorTrade.createMany({
                data: validEntries.map((e) => ({
                  contractorId: newContractor.id,
                  tradeId: e.tradeId,
                  isPrimary: e.isPrimary,
                })),
              });
            }
          }
        }

        // Insert contacts
        if (mergedData.contacts && Array.isArray(mergedData.contacts)) {
          const validContacts = mergedData.contacts.filter(
            (c: any) => c && typeof c === "object" && typeof c.name === "string" && c.name.trim().length > 0
          );
          if (validContacts.length > 0) {
            await tx.contractorContact.createMany({
              data: validContacts.map((c: any, idx: number) => ({
                contractorId: newContractor.id,
                name: c.name.trim(),
                jobTitle: c.jobTitle || null,
                phone: c.phone || null,
                mobile: c.mobile || null,
                email: c.email || null,
                isPrimary: c.isPrimary ?? idx === 0,
                notes: c.notes || null,
                isActive: true,
              })),
            });
          }
        }
      } else {
        // UPDATE_CONTRACTOR
        resultingContractorId = request.contractorId!;

        // Determine which fields to apply
        const updateData: Prisma.ContractorUpdateInput = {
          version: { increment: 1 },
        };

        const sourceData = input.editedData ? { ...proposed, ...input.editedData } : proposed;
        const acceptedSet = input.acceptedFields ? new Set(input.acceptedFields) : null;

        const allowedFields = [
          "companyName",
          "tradingName",
          "registrationNumber",
          "registrationType",
          "gstRegistered",
          "website",
          "mainPhone",
          "mainEmail",
          "addressLine1",
          "addressLine2",
          "suburb",
          "state",
          "postcode",
          "country",
          "serviceAreas",
          "afterHoursAvailable",
          "emergencyPhone",
          "paymentTerms",
        ];

        for (const field of allowedFields) {
          if (sourceData[field] !== undefined) {
            if (!acceptedSet || acceptedSet.has(field)) {
              (updateData as any)[field] = sourceData[field];
            }
          }
        }

        await tx.contractor.update({
          where: { id: resultingContractorId },
          data: updateData,
        });

        // Update trades if accepted
        if (sourceData.trades !== undefined && (!acceptedSet || acceptedSet.has("trades"))) {
          await tx.contractorTrade.deleteMany({ where: { contractorId: resultingContractorId } });
          if (Array.isArray(sourceData.trades) && sourceData.trades.length > 0) {
            const tradeEntries = extractTradeEntries(sourceData.trades);
            if (tradeEntries.length > 0) {
              const existingTrades = await tx.trade.findMany({
                where: { id: { in: tradeEntries.map((e) => e.tradeId) } },
                select: { id: true },
              });
              const validIds = new Set(existingTrades.map((et) => et.id));
              const validEntries = tradeEntries.filter((e) => validIds.has(e.tradeId));

              if (validEntries.length > 0) {
                await tx.contractorTrade.createMany({
                  data: validEntries.map((e) => ({
                    contractorId: resultingContractorId,
                    tradeId: e.tradeId,
                    isPrimary: e.isPrimary,
                  })),
                });
              }
            }
          }
        }
      }

      // Link supporting files to resulting contractor if specified or if attached to request
      const fileIdsToLink = new Set<string>(input.supportingFileIds || []);
      const requestFiles = await tx.fileLink.findMany({
        where: {
          entityType: "CONTRACTOR_REQUEST",
          entityId: id,
        },
        select: { fileObjectId: true },
      });
      for (const rf of requestFiles) {
        fileIdsToLink.add(rf.fileObjectId);
      }

      if (fileIdsToLink.size > 0) {
        for (const fileObjectId of fileIdsToLink) {
          const alreadyLinked = await tx.fileLink.findFirst({
            where: {
              fileObjectId,
              entityType: "CONTRACTOR",
              entityId: resultingContractorId,
            },
          });
          if (!alreadyLinked) {
            await tx.fileLink.create({
              data: {
                fileObjectId,
                entityType: "CONTRACTOR",
                entityId: resultingContractorId,
                kind: "OTHER",
                label: `Attached from request ${request.code}`,
                createdById: reviewerUser.id,
              },
            });
          }
        }
      }

      // Update request record
      const updatedRequest = await tx.contractorRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          reviewedById: reviewerUser.id,
          reviewedAt: new Date(),
          reviewNote: input.reviewNote || null,
          resultingContractorId,
        },
      });

      return { updatedRequest, resultingContractorId };
    });

    // Write audit log recording BOTH requester and reviewer
    await logAudit({
      entityType: "CONTRACTOR_REQUEST",
      entityId: id,
      userId: reviewerUser.id,
      action: "APPROVE_CONTRACTOR_REQUEST",
      newValue: {
        status: result.updatedRequest.status,
        requestedById: request.requestedById,
        reviewedById: reviewerUser.id,
        resultingContractorId: result.resultingContractorId,
        reviewNote: input.reviewNote,
      },
    });

    // Notify requester of decision
    await db.notification.create({
      data: {
        userId: request.requestedById,
        type: "CONTRACTOR_REQUEST_DECISION",
        title: `Contractor Request ${result.updatedRequest.status === "APPROVED" ? "Approved" : "Partially Approved"}`,
        body: input.reviewNote || `Your request (${request.code}) has been reviewed and accepted.`,
        entityType: "CONTRACTOR",
        entityId: result.resultingContractorId,
        linkUrl: `/contractors/${result.resultingContractorId}`,
      },
    });

    return result.updatedRequest;
  }

  /**
   * Reject a request (reason required).
   */
  public static async reject(id: string, input: RejectContractorRequestInput, reviewerUser: AuthenticatedUser) {
    const request = await db.contractorRequest.findUnique({
      where: { id },
    });

    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found");
    if (request.status !== "OPEN") {
      throw new AppError(400, "BAD_REQUEST", `Cannot reject request with status ${request.status}`);
    }

    const updated = await db.contractorRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewedById: reviewerUser.id,
        reviewedAt: new Date(),
        reviewNote: input.reviewNote,
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_REQUEST",
      entityId: id,
      userId: reviewerUser.id,
      action: "REJECT_CONTRACTOR_REQUEST",
      newValue: {
        status: "REJECTED",
        reason: input.reviewNote,
        requestedById: request.requestedById,
        reviewedById: reviewerUser.id,
      },
    });

    // Notify requester
    await db.notification.create({
      data: {
        userId: request.requestedById,
        type: "CONTRACTOR_REQUEST_DECISION",
        title: `Contractor Request Rejected`,
        body: `Your request (${request.code}) was not approved. Reason: ${input.reviewNote}`,
        entityType: "CONTRACTOR_REQUEST",
        entityId: request.id,
        linkUrl: `/contractors/requests/mine`,
      },
    });

    return updated;
  }

  /**
   * Request more info from requester.
   */
  public static async requestMoreInfo(id: string, input: RequestMoreInfoInput, reviewerUser: AuthenticatedUser) {
    const request = await db.contractorRequest.findUnique({
      where: { id },
    });

    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found");
    if (request.status !== "OPEN") {
      throw new AppError(400, "BAD_REQUEST", `Cannot request more info on status ${request.status}`);
    }

    const updated = await db.contractorRequest.update({
      where: { id },
      data: {
        reviewNote: input.reviewNote,
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_REQUEST",
      entityId: id,
      userId: reviewerUser.id,
      action: "REQUEST_MORE_INFO_CONTRACTOR_REQUEST",
      newValue: { note: input.reviewNote },
    });

    // Notify requester
    await db.notification.create({
      data: {
        userId: request.requestedById,
        type: "CONTRACTOR_REQUEST_MORE_INFO",
        title: `More Information Requested: ${request.code}`,
        body: input.reviewNote,
        entityType: "CONTRACTOR_REQUEST",
        entityId: request.id,
        linkUrl: `/contractors/requests/mine`,
      },
    });

    return updated;
  }

  /**
   * Withdraw own request (only requester can withdraw while OPEN).
   */
  public static async withdraw(id: string, userId: string) {
    const request = await db.contractorRequest.findUnique({
      where: { id },
    });

    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found");
    if (request.requestedById !== userId) {
      throw new AppError(403, "FORBIDDEN", "You can only withdraw your own requests");
    }
    if (request.status !== "OPEN") {
      throw new AppError(400, "BAD_REQUEST", `Only OPEN requests can be withdrawn (current: ${request.status})`);
    }

    const updated = await db.contractorRequest.update({
      where: { id },
      data: {
        status: "WITHDRAWN",
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_REQUEST",
      entityId: id,
      userId,
      action: "WITHDRAW_CONTRACTOR_REQUEST",
      newValue: { status: "WITHDRAWN" },
    });

    return updated;
  }
}
