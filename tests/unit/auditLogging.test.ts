import { describe, it, expect, vi } from "vitest";
import { isValidUuid, toValidUuid, UUID_REGEX, logAudit } from "@/core/audit/audit";
import { db } from "@/core/db";

describe("Audit Logging & UUID Safety", () => {
  it("correctly identifies valid and invalid UUIDs", () => {
    const valid = "123e4567-e89b-12d3-a456-426614174000";
    expect(isValidUuid(valid)).toBe(true);
    expect(isValidUuid("session")).toBe(false);
    expect(isValidUuid("system")).toBe(false);
    expect(isValidUuid("export")).toBe(false);
    expect(isValidUuid("admin@seva.local")).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
    expect(isValidUuid("")).toBe(false);
  });

  it("leaves valid UUIDs untouched", () => {
    const valid = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    expect(toValidUuid(valid)).toBe(valid);
  });

  it("converts non-UUID strings to deterministic valid UUIDs", () => {
    const convertedSession = toValidUuid("session");
    expect(isValidUuid(convertedSession)).toBe(true);
    expect(UUID_REGEX.test(convertedSession)).toBe(true);

    // Deterministic: calling it again with "session" returns the exact same UUID
    expect(toValidUuid("session")).toBe(convertedSession);

    const convertedEmail = toValidUuid("admin@seva.local");
    expect(isValidUuid(convertedEmail)).toBe(true);
    expect(convertedEmail).not.toBe(convertedSession);
  });

  it("safely writes audit logs with non-UUID entityId and invalid userId", async () => {
    const createSpy = vi.spyOn(db.activityLog, "create").mockResolvedValueOnce({
      id: "999e4567-e89b-12d3-a456-426614174000",
      entityType: "AUTH",
      entityId: toValidUuid("session"),
      occurrenceId: null,
      userId: null,
      action: "LOGOUT",
      oldValue: null,
      newValue: { _rawEntityId: "session" },
      createdAt: new Date(),
    } as any);

    await logAudit({
      entityType: "AUTH",
      entityId: "session",
      userId: "not-a-uuid",
      action: "LOGOUT",
    });

    expect(createSpy).toHaveBeenCalledTimes(1);
    const callArgs = createSpy.mock.calls[0]?.[0];
    expect(callArgs).toBeDefined();
    expect(isValidUuid(callArgs!.data.entityId)).toBe(true);
    expect(callArgs!.data.userId).toBeNull();
    expect((callArgs!.data.newValue as any)._rawEntityId).toBe("session");

    createSpy.mockRestore();
  });
});
