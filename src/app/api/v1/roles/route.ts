import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";
import { db } from "@/core/db";

export const runtime = "nodejs";

export const GET = withAuth("users.manage", async () => {
  const roles = await db.role.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      permissions: {
        select: { permissionKey: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({
    data: roles.map((r) => ({
      ...r,
      permissions: r.permissions.map((p) => p.permissionKey),
    })),
  });
});
