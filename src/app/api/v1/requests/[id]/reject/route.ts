import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/core/http/withAuth";
import { validateBody } from "@/core/http/validate";
import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { RequestStatus } from "@prisma/client";

export const runtime = "nodejs";

const rejectSchema = z
  .object({
    reason: z.string().min(1).max(2000),
  })
  .strict();

export const POST = withAuth("requests.manage", async (req, { user, params }) => {
  const { id } = params as { id: string };
  const body = await validateBody(rejectSchema, req);

  const request = await db.sevaRequest.findUnique({ where: { id } });
  if (!request) {
    throw new AppError(404, "REQUEST_NOT_FOUND", "Seva request not found");
  }

  if (request.status !== RequestStatus.OPEN) {
    throw new AppError(400, "REQUEST_NOT_OPEN", `Request is already ${request.status}`);
  }

  const updated = await db.sevaRequest.update({
    where: { id },
    data: {
      status: RequestStatus.REJECTED,
      adminNote: body.reason,
    },
    include: {
      category: true,
      area: true,
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Notify submitter
  await db.notification.create({
    data: {
      userId: request.requestedById,
      type: "REQUEST_REJECTED",
      title: `Maintenance Request Declined: ${request.title}`,
      body: `Reason: ${body.reason}`,
      entityType: "SEVA_REQUEST",
      entityId: id,
      linkUrl: "/requests",
    },
  });

  await logAudit({
    entityType: "SEVA_REQUEST",
    entityId: id,
    userId: user.id,
    action: "REJECT_REQUEST",
    newValue: { reason: body.reason },
  });

  return NextResponse.json({ data: updated });
});
