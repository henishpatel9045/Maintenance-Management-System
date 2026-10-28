import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ReviewService,
  ensureContractorsEnabled,
  updateReviewSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const PATCH = withAuth<{ reviewId: string }>("contractors.reviews.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(updateReviewSchema, req);
  const isAdmin = user.role === "ADMIN";
  const updated = await ReviewService.update(params.reviewId, body, user.id, isAdmin);

  return NextResponse.json({ data: updated });
});

export const DELETE = withAuth<{ reviewId: string }>("contractors.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const isAdmin = user.role === "ADMIN";
  const deleted = await ReviewService.delete(params.reviewId, user.id, isAdmin);

  return NextResponse.json({ success: true, data: deleted });
});
