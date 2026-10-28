import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import {
  CredentialService,
  ensureContractorsEnabled,
  createCredentialSchema,
} from "@/modules/contractors";

export const runtime = "nodejs";

export const GET = withAuth<{ id: string }>("contractors.read", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const credentials = await CredentialService.list(params.id, user);

  return NextResponse.json(
    { data: credentials },
    { headers: { "Cache-Control": "no-store" } }
  );
});

export const POST = withAuth<{ id: string }>("contractors.credentials.manage", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const body = await validateBody(createCredentialSchema, req);
  const created = await CredentialService.create(params.id, body, user.id);

  return NextResponse.json({ data: created }, { status: 201 });
});
