import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { ContactService, ensureContractorsEnabled } from "@/modules/contractors";

export const runtime = "nodejs";

export const POST = withAuth<{ contactId: string }>("contractors.write", async (req, { params, user }) => {
  await ensureContractorsEnabled();

  const updated = await ContactService.makePrimary(params.contactId, user.id);
  return NextResponse.json({ success: true, data: updated });
});
