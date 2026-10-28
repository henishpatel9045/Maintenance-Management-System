import { z } from "zod";

export const LicenceKindEnum = z.enum(["LICENCE", "TICKET", "CERTIFICATE", "COMPETENCY"]);
export const UserLicenceStatusEnum = z.enum([
  "PENDING_VERIFICATION",
  "VALID",
  "EXPIRING_SOON",
  "EXPIRED",
  "SUSPENDED",
  "REVOKED",
  "REJECTED",
  "SUPERSEDED",
]);
export const UserLicenceSourceEnum = z.enum(["ADMIN_ENTERED", "SELF_SUBMITTED", "IMPORTED"]);
export const UserAvailabilityStatusEnum = z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]);

// Luhn algorithm check to detect potential payment card numbers (Credit/Debit)
export function isLuhnValid(numberStr: string): boolean {
  const digits = numberStr.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits.charAt(i), 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

export function containsPaymentCard(text: string | null | undefined): boolean {
  if (!text) return false;
  const matches = text.match(/(?:\d[ -]?){13,19}/g);
  if (!matches) return false;
  for (const match of matches) {
    const cleaned = match.replace(/[\s-]/g, "");
    if (cleaned.length >= 13 && cleaned.length <= 19 && isLuhnValid(cleaned)) {
      return true;
    }
  }
  return false;
}

const safeTextField = (maxLength: number = 1000) =>
  z
    .string()
    .max(maxLength)
    .refine((val) => !containsPaymentCard(val), {
      message: "Potential payment card number detected. Storing payment cards is strictly prohibited.",
    });

// 1. Self-Service Schemas (Strict, mass-assignment proof)
export const selfSubmitLicenceSchema = z
  .object({
    licenceTypeId: z.string().uuid("Invalid licence type ID"),
    class: z.string().max(50).nullable().optional(),
    licenceNumber: z.string().max(100).nullable().optional(),
    issuer: z.string().max(255).nullable().optional(),
    issuedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    expiresAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    conditions: safeTextField(1000).nullable().optional(),
    notes: safeTextField(1000).nullable().optional(),
  })
  .strict();

export const renewLicenceSchema = z
  .object({
    class: z.string().max(50).nullable().optional(),
    licenceNumber: z.string().max(100).nullable().optional(),
    issuer: z.string().max(255).nullable().optional(),
    issuedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    expiresAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    conditions: safeTextField(1000).nullable().optional(),
    notes: safeTextField(1000).nullable().optional(),
  })
  .strict();

// 2. Admin Schemas
export const adminCreateLicenceSchema = z
  .object({
    userId: z.string().uuid("Invalid user ID"),
    licenceTypeId: z.string().uuid("Invalid licence type ID"),
    class: z.string().max(50).nullable().optional(),
    licenceNumber: z.string().max(100).nullable().optional(),
    issuer: z.string().max(255).nullable().optional(),
    issuedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    expiresAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    conditions: safeTextField(1000).nullable().optional(),
    notes: safeTextField(1000).nullable().optional(),
    status: UserLicenceStatusEnum.optional().default("VALID"),
    source: UserLicenceSourceEnum.optional().default("ADMIN_ENTERED"),
  })
  .strict();

export const adminUpdateLicenceSchema = z
  .object({
    class: z.string().max(50).nullable().optional(),
    licenceNumber: z.string().max(100).nullable().optional(),
    issuer: z.string().max(255).nullable().optional(),
    issuedAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    expiresAt: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
    conditions: safeTextField(1000).nullable().optional(),
    notes: safeTextField(1000).nullable().optional(),
    status: UserLicenceStatusEnum.optional(),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const updateLicenceSchema = adminUpdateLicenceSchema;
export const createLicenceAdminSchema = adminCreateLicenceSchema;

export const verifyLicenceSchema = z
  .object({
    status: z.enum(["VALID", "EXPIRING_SOON"]).optional().default("VALID"),
    notes: safeTextField(1000).nullable().optional(),
    expectedVersion: z.number().int().positive("expectedVersion is required for verification"),
  })
  .strict();

export const rejectLicenceSchema = z
  .object({
    rejectionReason: z.string().min(3, "Rejection reason must be at least 3 characters").max(1000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const suspendLicenceSchema = z
  .object({
    reason: z.string().min(3).max(1000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

export const revokeLicenceSchema = z
  .object({
    reason: z.string().min(3).max(1000),
    expectedVersion: z.number().int().positive().optional(),
  })
  .strict();

// 3. User Availability Schema
export const userAvailabilitySchema = z
  .object({
    status: UserAvailabilityStatusEnum,
    note: z.string().max(200, "Note must be at most 200 characters").nullable().optional(),
    availableUntil: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).nullable().optional(),
  })
  .strict();

// 4. Licence Types and Categories
export const licenceCategorySchema = z
  .object({
    name: z.string().min(2).max(100),
    sortOrder: z.number().int().optional().default(0),
  })
  .strict();

export const licenceTypeSchema = z
  .object({
    code: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, "Code must be lowercase alphanumeric with hyphens"),
    name: z.string().min(2).max(255),
    categoryId: z.string().uuid("Invalid category ID"),
    kind: LicenceKindEnum.default("LICENCE"),
    issuer: z.string().max(255).nullable().optional(),
    aliases: z.array(z.string()).optional().default([]),
    classes: z.array(z.string()).optional().default([]),
    hasExpiry: z.boolean().optional().default(true),
    defaultValidityMonths: z.number().int().positive().nullable().optional(),
    requiresNumber: z.boolean().optional().default(true),
    isHighlySensitive: z.boolean().optional().default(false),
    minHoldersTarget: z.number().int().nonnegative().nullable().optional(),
    description: z.string().max(2000).nullable().optional(),
    isActive: z.boolean().optional().default(true),
    sortOrder: z.number().int().optional().default(0),
  })
  .strict();

// 5. Query & Directory Schemas
export const directoryQuerySchema = z.object({
  q: z.string().optional(),
  licenceTypeId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  class: z.string().optional(),
  status: UserLicenceStatusEnum.optional(),
  expiringWithinDays: z.coerce.number().int().positive().optional(),
  availability: UserAvailabilityStatusEnum.optional(),
  validOn: z.string().optional(),
  includePending: z.coerce.boolean().optional().default(false),
  hasAll: z.string().or(z.array(z.string())).optional(),
  hasAny: z.string().or(z.array(z.string())).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
  sort: z.string().optional().default("name"),
  sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
});

// 6. Find Volunteers Schema
export const volunteerRequirementSchema = z.object({
  licenceTypeId: z.string().uuid("Invalid licence type ID"),
  class: z.string().optional(),
  minHolders: z.number().int().positive().optional().default(1),
});

export const findVolunteersSchema = z
  .object({
    requirements: z.array(volunteerRequirementSchema).min(1, "At least one licence requirement is required"),
    onDate: z.string().optional(),
    availability: UserAvailabilityStatusEnum.optional(),
    includeLimited: z.boolean().optional().default(true),
    excludeUserIds: z.array(z.string().uuid()).optional().default([]),
  })
  .strict();

// 7. Seva Required Licences Schema
export const sevaRequiredLicenceItemSchema = z.object({
  licenceTypeId: z.string().uuid("Invalid licence type ID"),
  classRequired: z.string().max(50).nullable().optional(),
  minHolders: z.number().int().positive().optional().default(1),
});

export const sevaRequiredLicencesSchema = z
  .object({
    requirements: z.array(sevaRequiredLicenceItemSchema),
  })
  .strict();

// 8. Import Preview / Commit Schemas
export const licenceImportRowSchema = z.object({
  userEmail: z.string().email(),
  licenceTypeCode: z.string(),
  class: z.string().optional(),
  licenceNumber: z.string().optional(),
  issuer: z.string().optional(),
  issuedAt: z.string().optional(),
  expiresAt: z.string().optional(),
  conditions: z.string().optional(),
  notes: z.string().optional(),
});

export const licenceImportCommitSchema = z
  .object({
    rows: z.array(licenceImportRowSchema),
  })
  .strict();
