import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { convertLeafToGroup } from "@/modules/seva/hierarchy";

export const runtime = "nodejs";

const convertGroupSchema = z
  .object({
    expectedVersion: z.number().int(),
  })
  .strict();

export const POST = withAuth("seva.update", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(convertGroupSchema, req);

  await convertLeafToGroup({
    sevaId: id,
    expectedVersion: body.expectedVersion,
    userId: user.id,
  });

  return NextResponse.json({ success: true, message: "Leaf seva successfully converted to Group container" });
});
