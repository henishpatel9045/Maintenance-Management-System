import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ReviewService,
  ensureContractorsEnabled,
  createReviewSchema,
  CreateReviewInput,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.read", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const data = await ReviewService.list(params.id, user);

  return NextResponse.json(
    { data: data.reviews, stats: data.stats },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withAuth<{ id: string }>("contractors.reviews.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = (await validateBody(createReviewSchema, req)) as CreateReviewInput;
  const created = await ReviewService.create(params.id, body, user.id);

  return NextResponse.json({ data: created }, { status: 201 });
});
