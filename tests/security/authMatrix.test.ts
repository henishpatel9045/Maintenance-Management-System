import { describe, it, expect } from "vitest";
import { can, AuthenticatedUser } from "../../src/core/permissions/can";
import { PERMISSION_KEYS, PermissionKey } from "../../src/core/permissions/keys";

describe("Security Suite: Authorization Matrix & Capability Tests", () => {
  const adminUser: AuthenticatedUser = {
    id: "admin-id",
    name: "Admin User",
    email: "admin@test.local",
    role: "ADMIN",
    isActive: true,
    permissions: new Set(PERMISSION_KEYS),
  };

  const coordinatorUser: AuthenticatedUser = {
    id: "coord-id",
    name: "Coordinator User",
    email: "coordinator@test.local",
    role: "COORDINATOR",
    isActive: true,
    permissions: new Set([
      "seva.read",
      "occurrence.updateStatus",
      "comments.create",
      "artefacts.view",
      "artefacts.upload",
      "artefacts.manage",
      "quotes.view",
      "quotes.upload",
      "quotes.manage",
      "files.download",
      "reports.view",
      "requests.create",
      "requests.manage",
      "masters.manage",
      "seva.assign",
    ]),
  };

  const memberUser: AuthenticatedUser = {
    id: "member-id",
    name: "Member User",
    email: "member@test.local",
    role: "MEMBER",
    isActive: true,
    permissions: new Set([
      "seva.read",
      "occurrence.updateStatus",
      "comments.create",
      "artefacts.view",
      "artefacts.upload",
      "files.download",
      "requests.create",
    ]),
  };

  const deactivatedUser: AuthenticatedUser = {
    id: "deactivated-id",
    name: "Deactivated User",
    email: "deactivated@test.local",
    role: "MEMBER",
    isActive: false,
    permissions: new Set(PERMISSION_KEYS),
  };

  it("denies all capabilities to anonymous (null/undefined) callers", () => {
    for (const perm of PERMISSION_KEYS) {
      expect(can(null, perm)).toBe(false);
      expect(can(undefined, perm)).toBe(false);
    }
  });

  it("denies all capabilities to deactivated users even if permissions exist", () => {
    for (const perm of PERMISSION_KEYS) {
      expect(can(deactivatedUser, perm)).toBe(false);
    }
  });

  it("grants all permissions to active ADMIN user", () => {
    for (const perm of PERMISSION_KEYS) {
      expect(can(adminUser, perm)).toBe(true);
    }
  });

  it("enforces coordinator boundary: cannot manage users, settings, or audit", () => {
    expect(can(coordinatorUser, "users.manage")).toBe(false);
    expect(can(coordinatorUser, "settings.manage")).toBe(false);
    expect(can(coordinatorUser, "audit.view")).toBe(false);
    expect(can(coordinatorUser, "seva.archive")).toBe(false);
  });

  it("allows coordinator to manage master records such as areas and categories", () => {
    expect(can(coordinatorUser, "masters.manage")).toBe(true);
    expect(can(memberUser, "masters.manage")).toBe(false);
  });

  it("enforces setting coordinatorsCanEditSeva for creating or updating seva", () => {
    // Default false
    expect(can(coordinatorUser, "seva.create", { seva: { id: "s1" } })).toBe(false);

    // Enabled via settings
    const coordinatorWithSetting: AuthenticatedUser = {
      ...coordinatorUser,
      permissions: new Set([...coordinatorUser.permissions, "seva.create"]),
      settings: { coordinatorsCanEditSeva: true },
    };
    expect(can(coordinatorWithSetting, "seva.create")).toBe(true);
  });

  it("enforces member boundary: cannot view or upload quotes by default", () => {
    expect(can(memberUser, "quotes.view")).toBe(false);
    expect(can(memberUser, "quotes.upload")).toBe(false);
    expect(can(memberUser, "quotes.manage")).toBe(false);
    expect(can(memberUser, "reports.view")).toBe(false);
  });

  it("allows member to view reports only if membersCanViewReports is true", () => {
    const memberWithReportPerm: AuthenticatedUser = {
      ...memberUser,
      permissions: new Set([...memberUser.permissions, "reports.view"]),
      settings: { membersCanViewReports: false },
    };
    expect(can(memberWithReportPerm, "reports.view")).toBe(false);

    const memberAllowed: AuthenticatedUser = {
      ...memberWithReportPerm,
      settings: { membersCanViewReports: true },
    };
    expect(can(memberAllowed, "reports.view")).toBe(true);
  });

  it("requires member to be an assignee to update status or upload artefacts", () => {
    const sevaContext = {
      seva: {
        id: "seva-123",
        assigneeIds: ["other-user-id"],
      },
      isAssignee: false,
    };

    // Not assigned -> denied
    expect(can(memberUser, "occurrence.updateStatus", sevaContext)).toBe(false);
    expect(can(memberUser, "artefacts.upload", sevaContext)).toBe(false);

    // Assigned -> granted
    const assignedContext = {
      seva: {
        id: "seva-123",
        assigneeIds: [memberUser.id],
      },
      isAssignee: true,
    };
    expect(can(memberUser, "occurrence.updateStatus", assignedContext)).toBe(true);
    expect(can(memberUser, "artefacts.upload", assignedContext)).toBe(true);
  });
});
