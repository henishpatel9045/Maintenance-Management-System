import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { moveSevaSubtree } from "@/modules/seva/hierarchy";

export const runtime = "nodejs";

const moveSchema = z
  .object({
    newParentId: z.string().uuid().nullable(),
    expectedVersion: z.number().int(),
  })
  .strict();

export const POST = withAuth("seva.update", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(moveSchema, req);

  const maxDepth = Number(user.settings?.["maxSevaDepth"] ?? 6);

  await moveSevaSubtree({
    sevaId: id,
    newParentId: body.newParentId,
    expectedVersion: body.expectedVersion,
    userId: user.id,
    maxDepthLimit: maxDepth,
  });

  return NextResponse.json({ success: true, message: "Seva subtree moved successfully" });
});
