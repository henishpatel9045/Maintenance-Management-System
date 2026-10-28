import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ContractorService,
  ensureContractorsEnabled,
  createContractorSchema,
  CreateContractorInput,
  ListContractorsFilters,
} from "@/modules/contractors";
import { ContractorStatus } from "@prisma/client";

export const runtime = "nodejs";

export const GET = withAuth("contractors.read", async (req, { user }) => {
  await ensureContractorsEnabled();

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || undefined;
  const tradeId = url.searchParams.get("tradeId") || undefined;
  const statusParam = url.searchParams.get("status");
  const status = statusParam ? (statusParam as ContractorStatus) : undefined;
  const isPreferredParam = url.searchParams.get("isPreferred");
  const isPreferred = isPreferredParam !== null ? isPreferredParam === "true" : undefined;
  const tag = url.searchParams.get("tag") || undefined;
  const suburb = url.searchParams.get("suburb") || undefined;
  const state = url.searchParams.get("state") || undefined;
  const ratingMinParam = url.searchParams.get("ratingMin");
  const ratingMin = ratingMinParam ? Number(ratingMinParam) : undefined;
  const afterHoursParam = url.searchParams.get("afterHours");
  const afterHours = afterHoursParam !== null ? afterHoursParam === "true" : undefined;
  const hasValidInsuranceParam = url.searchParams.get("hasValidInsurance");
  const hasValidInsurance = hasValidInsuranceParam !== null ? hasValidInsuranceParam === "true" : undefined;
  const credentialStatus = url.searchParams.get("credentialStatus") || undefined;
  const expiringWithinDaysParam = url.searchParams.get("expiringWithinDays");
  const expiringWithinDays = expiringWithinDaysParam ? Number(expiringWithinDaysParam) : undefined;
  const usedOnSevaId = url.searchParams.get("usedOnSevaId") || undefined;
  const sortByParam = url.searchParams.get("sortBy");
  const sortBy = sortByParam === "companyName" || sortByParam === "rating" || sortByParam === "code" || sortByParam === "createdAt"
    ? sortByParam
    : undefined;
  const sortOrderParam = url.searchParams.get("sortOrder");
  const sortOrder = sortOrderParam === "asc" || sortOrderParam === "desc" ? sortOrderParam : undefined;
  const page = url.searchParams.get("page") ? parseInt(url.searchParams.get("page")!, 10) : 1;
  const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : 20;

  const filters: ListContractorsFilters = {
    q,
    tradeId,
    status,
    isPreferred,
    tag,
    suburb,
    state,
    ratingMin,
    afterHours,
    hasValidInsurance,
    credentialStatus,
    expiringWithinDays,
    usedOnSevaId,
    sortBy,
    sortOrder,
    page,
    limit,
  };

  const result = await ContractorService.list(filters, user);

  return NextResponse.json(
    { data: result.items, meta: { total: result.total, page: result.page, limit: result.limit, totalPages: result.totalPages } },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withAuth("contractors.write", async (req, { user }) => {
  await ensureContractorsEnabled();

  const body = (await validateBody(createContractorSchema, req)) as CreateContractorInput;
  const created = await ContractorService.create(body, user.id);

  return NextResponse.json({ data: created }, { status: 201 });
});
