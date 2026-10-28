import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  SevaContractorService,
  ensureContractorsEnabled,
  createSevaContractorSchema,
  CreateSevaContractorInput,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("seva.read", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const links = await SevaContractorService.listForSeva(params.id, user);

  return NextResponse.json(
    { data: links },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const PUT = withAuth<{ id: string }>("contractors.assign", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = (await validateBody(createSevaContractorSchema, req)) as CreateSevaContractorInput;
  const link = await SevaContractorService.linkContractor(params.id, body, user.id);

  return NextResponse.json({ success: true, data: link });
});
