import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  ContactService,
  ensureContractorsEnabled,
  createContactSchema,
  CreateContactInput,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.read", async (req, { params }) => {
  await ensureContractorsEnabled();

  const contacts = await ContactService.list(params.id);
  return NextResponse.json({ data: contacts }, { headers: { "Cache-Control": "no-store" } });
});

export const POST = withAuth<{ id: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = (await validateBody(createContactSchema, req)) as CreateContactInput;
  const created = await ContactService.create(params.id, body, user.id);

  return NextResponse.json({ data: created }, { status: 201 });
});
