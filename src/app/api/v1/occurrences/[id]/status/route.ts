import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { updateOccurrenceStatus } from "@/modules/seva/status";
import { OccurrenceStatus } from "@prisma/client";
import { db } from "@/core/db";

export const runtime = "nodejs";

const statusSchema = z
  .object({
    status: z.nativeEnum(OccurrenceStatus),
    expectedVersion: z.number().int(),
    skipReason: z.string().optional(),
    completionNote: z.string().optional(),
    actualCost: z.number().optional(),
  })
  .strict();

export const PATCH = withAuth(
  {
    permission: "occurrence.updateStatus",
    getContext: async (_req, params) => {
      const { id } = params as { id: string };
      const occ = await db.occurrence.findUnique({
        where: { id },
        include: { seva: { include: { assignees: true } } },
      });
      return {
        seva: {
          id: occ?.sevaId || "",
          assigneeIds: occ?.seva.assignees.map((a) => a.userId) || [],
        },
      };
    },
  },
  async (req, { user, params }) => {
    const { id } = params as { id: string };
    const body = await validateBody(statusSchema, req);

    await updateOccurrenceStatus({
      occurrenceId: id,
      status: body.status,
      expectedVersion: body.expectedVersion,
      user,
      skipReason: body.skipReason,
      completionNote: body.completionNote,
      actualCost: body.actualCost,
    });

    return NextResponse.json({ success: true, message: "Occurrence status updated" });
  }
);
