import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/v1/reports/export/route";
import * as sessionModule from "@/core/auth/session";
import * as kpiModule from "@/modules/dashboard/kpi";
import { db } from "@/core/db";

describe("Reports Export API Route Handler (GET & POST)", () => {
  const mockAdminUser = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Seva Admin",
    email: "admin@seva.local",
    phone: null,
    role: "ADMIN",
    isActive: true,
    mustChangePassword: false,
    permissions: new Set(["reports.view", "seva.read", "quotes.view"]),
    settings: { orgName: "Test Mandir Maintenance" },
  };

  const mockSession = {
    id: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    userId: mockAdminUser.id,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db.activityLog, "create").mockResolvedValue({} as any);
    vi.spyOn(kpiModule, "computeKpis").mockResolvedValue({
      metrics: {
        total: 1,
        done: 1,
        inProgress: 0,
        pending: 0,
        overdue: 0,
        skipped: 0,
        cancelled: 0,
        completionPercent: 100,
        onTimePercent: 100,
        averageCompletionDays: 1,
        dueToday: 0,
        dueThisWeek: 1,
        totalBudget: 500,
        totalSpend: 450,
      },
      charts: {} as any,
    });
  });

  it("handles GET /api/v1/reports/export?format=csv returning 200 and CSV content", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      user: mockAdminUser,
      session: mockSession,
    });

    vi.spyOn(db.occurrence, "findMany").mockResolvedValueOnce([
      {
        id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33",
        dueDate: new Date("2026-10-30T10:00:00Z"),
        status: "PENDING",
        completedAt: null,
        actualCost: null,
        seva: {
          code: "SEV-001",
          title: "Clean Prayer Hall Air Conditioners",
          category: { name: "HVAC" },
          area: { name: "Main Mandir" },
          assignees: [{ user: { name: "Ramesh Patel" } }],
        },
        completedBy: null,
      } as any,
    ]);

    const req = new NextRequest("http://localhost:3000/api/v1/reports/export?format=csv", {
      method: "GET",
      headers: {
        cookie: "seva_session=valid-admin-token",
      },
    });

    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toContain('attachment; filename="seva-report.csv"');

    const csvText = await res.text();
    expect(csvText).toContain("Clean Prayer Hall Air Conditioners");
    expect(csvText).toContain("SEV-001");
    expect(csvText).toContain("HVAC");
    expect(csvText).toContain("Main Mandir");
    expect(csvText).toContain("Ramesh Patel");
  });

  it("handles POST /api/v1/reports/export returning 200 and CSV content", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      user: mockAdminUser,
      session: mockSession,
    });

    vi.spyOn(db.occurrence, "findMany").mockResolvedValueOnce([]);

    const req = new NextRequest("http://localhost:3000/api/v1/reports/export", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "seva_session=valid-admin-token",
      },
      body: JSON.stringify({ format: "csv" }),
    });

    const res = await POST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
  });

  it("rejects unauthorized requests without session", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce(null);

    const req = new NextRequest("http://localhost:3000/api/v1/reports/export?format=csv", {
      method: "GET",
    });

    const res = await GET(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
  });
});
