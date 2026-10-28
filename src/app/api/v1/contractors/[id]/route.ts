import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ContractorService,
  ensureContractorsEnabled,
  updateContractorSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.read", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const contractor = await ContractorService.getById(params.id, user);

  return NextResponse.json(
    { data: contractor },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PATCH = withAuth<{ id: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(updateContractorSchema, req);
  const updated = await ContractorService.update(
    params.id,
    body,
    body.expectedVersion,
    user.id
  );

  return NextResponse.json({ data: updated });
});
