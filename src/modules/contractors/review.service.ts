import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { CreateReviewInput, UpdateReviewInput } from "./schemas";
import { AuthenticatedUser } from "@/core/permissions/can";
import { sanitizeReview, getContractorTierContext } from "./tiers";

export class ReviewService {
  public static async list(contractorId: string, user: AuthenticatedUser) {
    const tierCtx = await getContractorTierContext(user);

    const reviews = await db.contractorReview.findMany({
      where: {
        contractorId,
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
      include: {
        reviewedBy: {
          select: { id: true, name: true },
        },
        seva: {
          select: { id: true, code: true, title: true },
        },
      },
    });

    const count = reviews.length;
    const avgRating =
      count > 0
        ? Number((reviews.reduce((acc, r) => acc + r.rating, 0) / count).toFixed(1))
        : null;

    const wouldUseAgainCount = reviews.filter((r) => r.wouldUseAgain).length;
    const wouldUseAgainPct = count > 0 ? Math.round((wouldUseAgainCount / count) * 100) : null;

    return {
      reviews: reviews.map((r) => sanitizeReview(r, tierCtx)),
      stats: {
        count,
        avgRating,
        wouldUseAgainPct,
      },
    };
  }

  public static async create(contractorId: string, input: CreateReviewInput, userId: string) {
    const contractor = await db.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    if (input.sevaId) {
      const seva = await db.seva.findUnique({ where: { id: input.sevaId } });
      if (!seva) throw new AppError(404, "NOT_FOUND", "Linked seva not found");
    }

    const review = await db.contractorReview.create({
      data: {
        contractorId,
        sevaId: input.sevaId || null,
        rating: input.rating,
        qualityRating: input.qualityRating || null,
        timelinessRating: input.timelinessRating || null,
        priceRating: input.priceRating || null,
        wouldUseAgain: input.wouldUseAgain ?? true,
        comment: input.comment || null,
        reviewedById: userId,
      },
      include: {
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_REVIEW",
      entityId: review.id,
      userId,
      action: "CREATE_CONTRACTOR_REVIEW",
      newValue: { rating: review.rating, contractorId },
    });

    // Notify coordinators and admins
    const coordinators = await db.user.findMany({
      where: {
        role: { name: { in: ["ADMIN", "COORDINATOR"] } },
        isActive: true,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (coordinators.length > 0) {
      await db.notification.createMany({
        data: coordinators.map((c) => ({
          userId: c.id,
          type: "CONTRACTOR_REVIEW_POSTED",
          title: `New Review for ${contractor.companyName}`,
          body: `Rating: ${review.rating}/5 posted by ${review.reviewedBy.name}`,
          entityType: "CONTRACTOR",
          entityId: contractor.id,
          linkUrl: `/contractors/${contractor.id}`,
        })),
      });
    }

    return review;
  }

  public static async update(reviewId: string, input: UpdateReviewInput, userId: string, isAdmin: boolean) {
    const existing = await db.contractorReview.findUnique({
      where: { id: reviewId },
    });

    if (!existing || existing.deletedAt) {
      throw new AppError(404, "NOT_FOUND", "Review not found");
    }

    // 24 hour edit window constraint: reviewer can edit only within 24h, admin can always edit
    if (!isAdmin) {
      if (existing.reviewedById !== userId) {
        throw new AppError(403, "FORBIDDEN", "You can only edit your own reviews");
      }
      const ageHours = (Date.now() - existing.createdAt.getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        throw new AppError(400, "EDIT_WINDOW_EXPIRED", "Reviews can only be edited within 24 hours of submission");
      }
    }

    const updated = await db.contractorReview.update({
      where: { id: reviewId },
      data: {
        ...(input.rating !== undefined ? { rating: input.rating } : {}),
        ...(input.qualityRating !== undefined ? { qualityRating: input.qualityRating } : {}),
        ...(input.timelinessRating !== undefined ? { timelinessRating: input.timelinessRating } : {}),
        ...(input.priceRating !== undefined ? { priceRating: input.priceRating } : {}),
        ...(input.wouldUseAgain !== undefined ? { wouldUseAgain: input.wouldUseAgain } : {}),
        ...(input.comment !== undefined ? { comment: input.comment } : {}),
      },
    });

    await logAudit({
      entityType: "CONTRACTOR_REVIEW",
      entityId: reviewId,
      userId,
      action: "UPDATE_CONTRACTOR_REVIEW",
      oldValue: { rating: existing.rating },
      newValue: { rating: updated.rating, changes: input },
    });

    return updated;
  }

  public static async delete(reviewId: string, userId: string, isAdmin: boolean) {
    const existing = await db.contractorReview.findUnique({
      where: { id: reviewId },
    });

    if (!existing || existing.deletedAt) {
      throw new AppError(404, "NOT_FOUND", "Review not found");
    }

    if (!isAdmin) {
      throw new AppError(403, "FORBIDDEN", "Only administrators can delete reviews");
    }

    const updated = await db.contractorReview.update({
      where: { id: reviewId },
      data: { deletedAt: new Date() },
    });

    await logAudit({
      entityType: "CONTRACTOR_REVIEW",
      entityId: reviewId,
      userId,
      action: "DELETE_CONTRACTOR_REVIEW",
      newValue: { deletedAt: updated.deletedAt },
    });

    return updated;
  }
}
