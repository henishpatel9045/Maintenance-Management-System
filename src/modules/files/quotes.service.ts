import { QuoteStatus } from "@prisma/client";
import { db } from "../../core/db";
import { AppError } from "../../core/http/error";
import { logAudit } from "../../core/audit/audit";

export async function approveQuote(params: {
  sevaFileId: string;
  userId: string;
}): Promise<void> {
  const { sevaFileId, userId } = params;

  await db.$transaction(async (tx) => {
    const sevaFile = await tx.sevaFile.findUnique({
      where: { id: sevaFileId },
      include: { seva: true },
    });

    if (!sevaFile || sevaFile.deletedAt) {
      throw new AppError(404, "FILE_NOT_FOUND", "Quote file not found");
    }

    if (sevaFile.bucket !== "QUOTE") {
      throw new AppError(400, "INVALID_BUCKET", "Selected file is not in the Quotes bucket");
    }

    // 1. Revoke any previously approved quote on this seva
    await tx.sevaFile.updateMany({
      where: {
        sevaId: sevaFile.sevaId,
        quoteStatus: QuoteStatus.APPROVED,
        id: { not: sevaFileId },
      },
      data: {
        quoteStatus: QuoteStatus.UNDER_REVIEW,
        approvedById: null,
        approvedAt: null,
      },
    });

    const now = new Date();

    // 2. Mark this quote as APPROVED
    await tx.sevaFile.update({
      where: { id: sevaFileId },
      data: {
        quoteStatus: QuoteStatus.APPROVED,
        approvedById: userId,
        approvedAt: now,
      },
    });

    // 3. Update Seva approvedBudget
    const oldBudget = sevaFile.seva.approvedBudget;
    await tx.seva.update({
      where: { id: sevaFile.sevaId },
      data: {
        approvedBudget: sevaFile.amount,
        version: { increment: 1 },
      },
    });

    // 4. Log activity
    await logAudit({
      entityType: "SEVA_FILE",
      entityId: sevaFileId,
      userId,
      action: "APPROVE_QUOTE",
      oldValue: { quoteStatus: sevaFile.quoteStatus, approvedBudget: oldBudget },
      newValue: { quoteStatus: QuoteStatus.APPROVED, approvedBudget: sevaFile.amount },
    });
  });
}

export async function revokeQuoteApproval(params: {
  sevaFileId: string;
  userId: string;
}): Promise<void> {
  const { sevaFileId, userId } = params;

  await db.$transaction(async (tx) => {
    const sevaFile = await tx.sevaFile.findUnique({
      where: { id: sevaFileId },
      include: { seva: true },
    });

    if (!sevaFile || sevaFile.deletedAt) {
      throw new AppError(404, "FILE_NOT_FOUND", "Quote file not found");
    }

    if (sevaFile.quoteStatus !== QuoteStatus.APPROVED) {
      throw new AppError(400, "NOT_APPROVED", "Quote is not currently approved");
    }

    await tx.sevaFile.update({
      where: { id: sevaFileId },
      data: {
        quoteStatus: QuoteStatus.UNDER_REVIEW,
        approvedById: null,
        approvedAt: null,
      },
    });

    await tx.seva.update({
      where: { id: sevaFile.sevaId },
      data: {
        approvedBudget: null,
        version: { increment: 1 },
      },
    });

    await logAudit({
      entityType: "SEVA_FILE",
      entityId: sevaFileId,
      userId,
      action: "REVOKE_QUOTE_APPROVAL",
      oldValue: { quoteStatus: QuoteStatus.APPROVED, approvedBudget: sevaFile.amount },
      newValue: { quoteStatus: QuoteStatus.UNDER_REVIEW, approvedBudget: null },
    });
  });
}

export async function compareQuotesForSeva(sevaId: string): Promise<{
  quotes: Array<{
    id: string;
    supplierName: string | null;
    amount: number | null;
    currency: string;
    validUntil: Date | null;
    quoteStatus: QuoteStatus | null;
    notes: string | null;
    isLowest: boolean;
    fileObjectId: string;
    originalName: string;
    approvedAt: Date | null;
  }>;
  lowestAmount: number | null;
}> {
  const quotes = await db.sevaFile.findMany({
    where: {
      sevaId,
      bucket: "QUOTE",
      deletedAt: null,
    },
    include: {
      fileObject: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const validAmounts = quotes
    .map((q) => (q.amount ? Number(q.amount) : null))
    .filter((a): a is number => a !== null && a > 0);

  const lowestAmount = validAmounts.length > 0 ? Math.min(...validAmounts) : null;

  return {
    quotes: quotes.map((q) => {
      const numAmount = q.amount ? Number(q.amount) : null;
      return {
        id: q.id,
        supplierName: q.supplierName,
        amount: numAmount,
        currency: q.currency,
        validUntil: q.validUntil,
        quoteStatus: q.quoteStatus,
        notes: q.notes,
        isLowest: lowestAmount !== null && numAmount === lowestAmount,
        fileObjectId: q.fileObjectId,
        originalName: q.fileObject.originalName,
        approvedAt: q.approvedAt,
      };
    }),
    lowestAmount,
  };
}
