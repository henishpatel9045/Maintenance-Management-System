import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as bulkArchivePOST } from "@/app/api/v1/seva/bulk-archive/route";
import { POST as bulkUnarchivePOST } from "@/app/api/v1/seva/bulk-unarchive/route";
import { POST as bulkDeletePOST } from "@/app/api/v1/seva/bulk-delete/route";
import * as sessionModule from "@/core/auth/session";
import * as archiveService from "@/modules/seva/archiveService";
import { db } from "@/core/db";

describe("Seva Bulk Actions API & Archive Purge Suite", () => {
  const mockCoordinator = {
    id: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Coordinator User",
    email: "coordinator@seva.local",
    phone: null,
    role: "COORDINATOR",
    isActive: true,
    mustChangePassword: false,
    permissions: new Set(["seva.read", "seva.assign"]),
    settings: {},
  };

  const mockMember = {
    id: "m0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Member User",
    email: "member@seva.local",
    phone: null,
    role: "MEMBER",
    isActive: true,
    mustChangePassword: false,
    permissions: new Set(["seva.read"]),
    settings: {},
  };

  const mockSession = {
    id: "s0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22",
    userId: mockCoordinator.id,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(db.activityLog, "create").mockResolvedValue({} as any);
  });

  it("allows Coordinator to bulk archive sevas with scheduled file purge", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      user: mockCoordinator,
      session: mockSession,
    });

    const testId = "11111111-1111-1111-1111-111111111111";
    vi.spyOn(archiveService, "bulkArchiveSevas").mockResolvedValueOnce({
      archivedCount: 1,
      purgeScheduled: true,
      purgeAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      fileCount: 3,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/seva/bulk-archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "seva_session=valid-token",
      },
      body: JSON.stringify({
        sevaIds: [testId],
        scheduleFilePurge: true,
      }),
    });

    const res = await bulkArchivePOST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.archivedCount).toBe(1);
    expect(json.purgeScheduled).toBe(true);
    expect(json.fileCount).toBe(3);
  });

  it("denies unprivileged member from bulk archiving sevas", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      user: mockMember,
      session: { id: "s-mem", userId: mockMember.id },
    });

    const req = new NextRequest("http://localhost:3000/api/v1/seva/bulk-archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "seva_session=valid-token",
      },
      body: JSON.stringify({
        sevaIds: ["11111111-1111-1111-1111-111111111111"],
      }),
    });

    const res = await bulkArchivePOST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
  });

  it("allows Coordinator to bulk unarchive sevas", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      user: mockCoordinator,
      session: mockSession,
    });

    const testId = "11111111-1111-1111-1111-111111111111";
    vi.spyOn(archiveService, "bulkUnarchiveSevas").mockResolvedValueOnce({
      unarchivedCount: 2,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/seva/bulk-unarchive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "seva_session=valid-token",
      },
      body: JSON.stringify({
        sevaIds: [testId],
      }),
    });

    const res = await bulkUnarchivePOST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.unarchivedCount).toBe(2);
  });

  it("allows Coordinator to bulk delete sevas", async () => {
    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      user: mockCoordinator,
      session: mockSession,
    });

    const testId = "11111111-1111-1111-1111-111111111111";
    vi.spyOn(archiveService, "bulkDeleteSevas").mockResolvedValueOnce({
      deletedCount: 3,
    });

    const req = new NextRequest("http://localhost:3000/api/v1/seva/bulk-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: "seva_session=valid-token",
      },
      body: JSON.stringify({
        sevaIds: [testId],
      }),
    });

    const res = await bulkDeletePOST(req, { params: Promise.resolve({}) });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.deletedCount).toBe(3);
  });

  it("executes scheduled purge entries when 24h has elapsed and preserves unexpired entries", async () => {
    const expiredEntry = {
      id: "entry-expired",
      sevaIds: ["s1"],
      scheduledPurgeAt: new Date(Date.now() - 1000).toISOString(),
      requestedById: mockCoordinator.id,
      requestedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
      fileCount: 1,
    };

    const futureEntry = {
      id: "entry-future",
      sevaIds: ["s2"],
      scheduledPurgeAt: new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(),
      requestedById: mockCoordinator.id,
      requestedAt: new Date().toISOString(),
      fileCount: 2,
    };

    vi.spyOn(db.setting, "findUnique").mockResolvedValueOnce({
      key: "archive_files_purge_queue",
      value: [expiredEntry, futureEntry] as any,
      updatedAt: new Date(),
    });

    vi.spyOn(db.sevaFile, "findMany").mockResolvedValueOnce([
      {
        id: "sf-1",
        fileObjectId: "fo-1",
        fileObject: { storageKey: "sevas/s1/test.pdf", thumbnailKey: null },
      } as any,
    ]);

    vi.spyOn(db.sevaFile, "deleteMany").mockResolvedValueOnce({ count: 1 });
    vi.spyOn(db.sevaFile, "count").mockResolvedValueOnce(0);
    vi.spyOn(db.fileObject, "delete").mockResolvedValueOnce({} as any);
    const updateSpy = vi.spyOn(db.setting, "update").mockResolvedValueOnce({} as any);

    const result = await archiveService.executeScheduledFilePurges();
    expect(result.purgedEntries).toBe(1);
    expect(result.deletedFilesCount).toBe(1);

    // Verify setting was updated to keep future entry
    expect(updateSpy).toHaveBeenCalledWith({
      where: { key: "archive_files_purge_queue" },
      data: { value: [futureEntry] },
    });
  });
});
