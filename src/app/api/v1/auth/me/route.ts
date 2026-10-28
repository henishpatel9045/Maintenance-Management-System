import { NextResponse } from "next/server";
import { withAuth } from "@/core/http/withAuth";

export const runtime = "nodejs";

export const GET = withAuth({}, async (_req, { user }) => {
  return NextResponse.json({
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        mustChangePassword: user.mustChangePassword,
        permissions: Array.from(user.permissions),
        settings: user.settings,
      },
    },
  });
});
