import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { archiveSevaSubtree } from "@/modules/seva/hierarchy";

export const runtime = "nodejs";

export const POST = withAuth("seva.archive", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const url = new URL(req.url);
  const archiveSubtree = url.searchParams.get("subtree") !== "false";

  const result = await archiveSevaSubtree({
    sevaId: id,
    userId: user.id,
    archiveSubtree,
  });

  return NextResponse.json({ success: true, archivedCount: result.count });
});
