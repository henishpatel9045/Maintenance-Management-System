import { describe, it, expect } from "vitest";
import { buildAreaPath, getAreaDescendantIds } from "./utils";
import { can, AuthenticatedUser } from "@/core/permissions/can";

describe("Dynamic Area Management Tests", () => {
  const coordinator: AuthenticatedUser = {
    id: "coord-1",
    name: "Campus Coordinator",
    email: "coordinator@seva.local",
    role: "COORDINATOR",
    isActive: true,
    permissions: new Set(["masters.manage", "seva.read"]),
  };

  const member: AuthenticatedUser = {
    id: "mem-1",
    name: "Community Member",
    email: "member@seva.local",
    role: "MEMBER",
    isActive: true,
    permissions: new Set(["seva.read"]),
  };

  it("authorizes coordinators to manage dynamic areas", () => {
    expect(can(coordinator, "masters.manage")).toBe(true);
    expect(can(member, "masters.manage")).toBe(false);
  });

  describe("buildAreaPath utility", () => {
    const areas = [
      { id: "root-1", name: "Main Complex", parentId: null },
      { id: "floor-1", name: "Ground Floor", parentId: "root-1" },
      { id: "room-1", name: "Prayer Hall", parentId: "floor-1" },
      { id: "room-2", name: "Dining Hall", parentId: "floor-1" },
      { id: "root-2", name: "Gardens & Outdoors", parentId: null },
    ];

    const areasMap = new Map(areas.map((a) => [a.id, a]));

    it("formats top-level area names cleanly", () => {
      expect(buildAreaPath("root-1", areasMap)).toBe("Main Complex");
      expect(buildAreaPath("root-2", areasMap)).toBe("Gardens & Outdoors");
    });

    it("formats single-level nested area paths", () => {
      expect(buildAreaPath("floor-1", areasMap)).toBe("Main Complex → Ground Floor");
    });

    it("formats deep multi-level nested area paths", () => {
      expect(buildAreaPath("room-1", areasMap)).toBe("Main Complex → Ground Floor → Prayer Hall");
      expect(buildAreaPath("room-2", areasMap)).toBe("Main Complex → Ground Floor → Dining Hall");
    });

    it("returns empty string for non-existent area ID", () => {
      expect(buildAreaPath("non-existent-id", areasMap)).toBe("");
    });
  });

  describe("getAreaDescendantIds utility (cycle prevention)", () => {
    const areas = [
      { id: "a1", parentId: null },
      { id: "a2", parentId: "a1" },
      { id: "a3", parentId: "a2" },
      { id: "a4", parentId: "a2" },
      { id: "b1", parentId: null },
    ];

    it("identifies direct and indirect descendants", () => {
      const descendantsOfA1 = getAreaDescendantIds("a1", areas);
      expect(descendantsOfA1.has("a2")).toBe(true);
      expect(descendantsOfA1.has("a3")).toBe(true);
      expect(descendantsOfA1.has("a4")).toBe(true);
      expect(descendantsOfA1.has("b1")).toBe(false);
    });

    it("returns empty set for leaf areas with no children", () => {
      const descendantsOfA3 = getAreaDescendantIds("a3", areas);
      expect(descendantsOfA3.size).toBe(0);
    });

    it("identifies sub-tree descendants properly", () => {
      const descendantsOfA2 = getAreaDescendantIds("a2", areas);
      expect(descendantsOfA2.has("a3")).toBe(true);
      expect(descendantsOfA2.has("a4")).toBe(true);
      expect(descendantsOfA2.has("a1")).toBe(false);
    });
  });
});
