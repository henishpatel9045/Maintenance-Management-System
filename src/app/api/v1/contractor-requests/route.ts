import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  RequestService,
  ensureContractorsEnabled,
  createContractorRequestSchema,
} from "@/modules/contractors";
import { ContractorRequestStatus, ContractorRequestType } from "@prisma/client";

export const runtime = "nodejs";

export const GET = withAuth("contractors.requests.review", async (req) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? (statusParam as ContractorRequestStatus) : undefined;
  const typeParam = url.searchParams.get("type");
  const type = typeParam ? (typeParam as ContractorRequestType) : undefined;
  const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20;

  const result = await RequestService.listQueue({ status, type, page, limit });

  return NextResponse.json(
    { data: result.items, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withAuth("contractors.request", async (req, { user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(createContractorRequestSchema, req);
  const created = await RequestService.submit(body, user.id);

  return NextResponse.json({ data: created }, { status: 201 });
});
