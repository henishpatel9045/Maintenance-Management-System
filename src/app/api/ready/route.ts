import { NextResponse } from "next/server";
import { db } from "@/core/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "ready",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "not_ready",
        database: "disconnected",
        error: err.message || "Database connection check failed",
      },
      { status: 503 }
    );
  }
}
