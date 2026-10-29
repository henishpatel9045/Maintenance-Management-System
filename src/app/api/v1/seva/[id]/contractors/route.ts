import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { z } from "zod";
import {
  SevaContractorService,
  ensureContractorsEnabled,
  createSevaContractorSchema,
  syncSevaContractorsSchema,
  CreateSevaContractorInput,
} from "@/modules/contractors";

export const runtime = "nodejs";

const putContractorPayloadSchema = z.union([
  syncSevaContractorsSchema,
  createSevaContractorSchema,
]);

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

  const body = await validateBody(putContractorPayloadSchema, req);

  if ("contractors" in body && Array.isArray(body.contractors)) {
    await SevaContractorService.syncContractorsForSeva(params.id, body.contractors, user.id);
    const links = await SevaContractorService.listForSeva(params.id, user);
    return NextResponse.json({ success: true, data: links });
  } else {
    const link = await SevaContractorService.linkContractor(params.id, body as CreateSevaContractorInput, user.id);
    return NextResponse.json({ success: true, data: link });
  }
});

export const POST = withAuth<{ id: string }>("contractors.assign", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = (await validateBody(createSevaContractorSchema, req)) as CreateSevaContractorInput;
  const link = await SevaContractorService.linkContractor(params.id, body, user.id);

  return NextResponse.json({ success: true, data: link });
});

export const DELETE = withAuth<{ id: string }>("contractors.assign", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const { searchParams } = new URL(req.url);
  const linkId = searchParams.get("linkId");
  const contractorId = searchParams.get("contractorId");

  if (linkId) {
    await SevaContractorService.removeLink(linkId, user.id);
  } else if (contractorId) {
    const existing = await SevaContractorService.listForSeva(params.id, user);
    const target = existing.find((l: any) => l.contractorId === contractorId);
    if (target) {
      await SevaContractorService.removeLink(target.id, user.id);
    }
  }

  const links = await SevaContractorService.listForSeva(params.id, user);
  return NextResponse.json({ success: true, data: links });
});
