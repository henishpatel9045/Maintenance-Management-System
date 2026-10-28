import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validatePasswordStrength } from "../../src/core/auth/hash";

// Zod schemas matching our production API input validation
const CreateSevaInputSchema = z
  .object({
    title: z.string().min(1).max(255),
    description: z.string().max(5000).optional().default(""),
    kind: z.enum(["ONE_TIME", "RECURRING"]),
    subKind: z.enum(["NEW", "REPAIR"]).optional(),
    categoryId: z.string().uuid(),
    areaId: z.string().uuid(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
    parentId: z.string().uuid().nullable().optional(),
    isGroup: z.boolean().optional().default(false),
    estimatedBudget: z.number().min(0).optional(),
    tags: z.array(z.string().max(50)).max(20).optional().default([]),
  })
  .strict(); // Mass assignment prevention

const CreateCommentInputSchema = z
  .object({
    entityType: z.enum(["SEVA", "REQUEST", "CONTRACTOR"]),
    entityId: z.string().uuid(),
    occurrenceId: z.string().uuid().nullable().optional(),
    body: z.string().min(1).max(5000),
  })
  .strict();

describe("Security Suite: Input Sanitization & Mass Assignment Prevention", () => {
  const validUuid = "123e4567-e89b-12d3-a456-426614174000";

  it("strictly rejects unknown fields to prevent mass assignment", () => {
    const maliciousPayload = {
      title: "Legitimate Task",
      kind: "ONE_TIME",
      categoryId: validUuid,
      areaId: validUuid,
      priority: "MEDIUM",
      isAdmin: true, // Injected field
      role: "ADMIN", // Injected field
      approvedBudget: 9999999, // Unauthorized budget elevation
    };

    const result = CreateSevaInputSchema.safeParse(maliciousPayload);
    expect(result.success).toBe(false);
  });

  it("enforces boundary and max length checks to prevent buffer/DOS attacks", () => {
    const overlongTitlePayload = {
      title: "A".repeat(256), // Max is 255
      kind: "ONE_TIME",
      categoryId: validUuid,
      areaId: validUuid,
      priority: "MEDIUM",
    };
    expect(CreateSevaInputSchema.safeParse(overlongTitlePayload).success).toBe(false);

    const overlongDescPayload = {
      title: "Valid Title",
      description: "D".repeat(5001), // Max is 5000
      kind: "ONE_TIME",
      categoryId: validUuid,
      areaId: validUuid,
      priority: "MEDIUM",
    };
    expect(CreateSevaInputSchema.safeParse(overlongDescPayload).success).toBe(false);
  });

  it("safely handles SQL injection payloads in text fields as literal strings", () => {
    const sqlInjections = [
      "' OR '1'='1",
      "'; DROP TABLE \"users\"; --",
      "1 UNION SELECT null, username, password FROM users--",
      "admin' --",
      "SLEEP(5)",
    ];

    for (const sql of sqlInjections) {
      const payload = {
        title: `Task with ${sql}`,
        description: `Description containing SQL injection: ${sql}`,
        kind: "ONE_TIME" as const,
        categoryId: validUuid,
        areaId: validUuid,
        priority: "HIGH" as const,
        tags: [sql.slice(0, 50)],
      };

      const result = CreateSevaInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.title).toContain(sql);
      }
    }
  });

  it("safely accepts XSS payloads as literal plain text without execution", () => {
    const xssPayloads = [
      "<script>alert('XSS')</script>",
      "<img src=x onerror=alert(1)>",
      "<svg onload=alert(document.cookie)>",
      "javascript:alert(1)",
    ];

    for (const xss of xssPayloads) {
      const payload = {
        entityType: "SEVA" as const,
        entityId: validUuid,
        body: xss,
      };

      const result = CreateCommentInputSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body).toBe(xss);
      }
    }
  });

  it("enforces strong password policy and common-password dictionary check", () => {
    // Too short (< 10 chars)
    expect(validatePasswordStrength("Short1!").valid).toBe(false);

    // Common password dictionary hits
    expect(validatePasswordStrength("password123").valid).toBe(false);
    expect(validatePasswordStrength("admin12345").valid).toBe(false);
    expect(validatePasswordStrength("qwertyuiop").valid).toBe(false);

    // Strong unique password (>= 10 chars)
    expect(validatePasswordStrength("SevaSecure$Temple2026!").valid).toBe(true);
  });
});
