import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { approveQuote } from "@/modules/files/quotes.service";

export const runtime = "nodejs";

export const POST = withAuth("quotes.manage", async (_req, { user, params }) => {
  const { id } = params as { id: string };

  await approveQuote({
    sevaFileId: id,
    userId: user.id,
  });

  return NextResponse.json({ success: true, message: "Quote approved and seva budget updated" });
});
