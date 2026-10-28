import { z } from "zod";
import {
  ContractorStatus,
  CredentialKind,
  CredentialStatus,
  SevaContractorRole,
  SevaContractorStatus,
  ContractorRequestType,
} from "@prisma/client";
import { isValidABN, containsPaymentCard } from "./validation";

// Custom Luhn check validator to prevent card numbers in free text
const safeTextField = (maxLength: number = 2000) =>
  z
    .string()
    .max(maxLength)
    .refine((val) => !containsPaymentCard(val), {
      message: "Potential payment card number detected. Storing payment card numbers is strictly prohibited.",
    });

// Australian ABN refinement
const abnRefinement = (val: string | null | undefined, type: string | null | undefined) => {
  if (!val) return true;
  if (!type || type.toUpperCase() === "ABN") {
    return isValidABN(val);
  }
  return true;
};

export const createContractorSchema = z
  .object({
    companyName: z.string().trim().min(1, "Company name is required").max(255),
    tradingName: z.string().trim().max(255).optional().nullable(),
    registrationNumber: z.string().trim().max(100).optional().nullable(),
    registrationType: z.string().trim().max(50).default("ABN").optional().nullable(),
    gstRegistered: z.boolean().default(false),
    status: z.nativeEnum(ContractorStatus).default(ContractorStatus.ACTIVE).optional(),
    isPreferred: z.boolean().default(false),
    website: z
      .string()
      .trim()
      .max(255)
      .optional()
      .nullable()
      .refine(
        (val) => !val || /^https?:\/\//i.test(val) || /^www\./i.test(val),
        "Website must be a valid URL"
      ),
    mainPhone: z.string().trim().max(50).optional().nullable(),
    mainEmail: z.string().trim().email("Invalid email address").max(255).optional().nullable().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().nullable(),
    addressLine2: z.string().trim().max(255).optional().nullable(),
    suburb: z.string().trim().max(100).optional().nullable(),
    state: z.string().trim().max(50).optional().nullable(),
    postcode: z.string().trim().max(20).optional().nullable(),
    country: z.string().trim().max(50).default("AU"),
    serviceAreas: z.array(z.string().trim().max(100)).default([]),
    afterHoursAvailable: z.boolean().default(false),
    emergencyPhone: z.string().trim().max(50).optional().nullable(),
    paymentTerms: z.string().trim().max(100).optional().nullable(),
    callOutFee: z.coerce.number().min(0).optional().nullable(),
    hourlyRate: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(10).default("AUD"),
    internalNotes: safeTextField(5000).optional().nullable(),
    tradeIds: z.array(z.string().uuid()).default([]).optional(),
    primaryTradeId: z.string().uuid().optional().nullable(),
    contacts: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(255),
          jobTitle: z.string().trim().max(100).optional().nullable(),
          phone: z.string().trim().max(50).optional().nullable(),
          mobile: z.string().trim().max(50).optional().nullable(),
          email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
          isPrimary: z.boolean().default(false),
          notes: safeTextField(2000).optional().nullable(),
          isActive: z.boolean().default(true),
        })
      )
      .optional()
      .default([]),
    tags: z.array(z.string().trim().max(50)).default([]),
  })
  .strict()
  .refine(
    (data) => abnRefinement(data.registrationNumber, data.registrationType),
    {
      message: "Invalid Australian Business Number (ABN) checksum or format",
      path: ["registrationNumber"],
    }
  );

export const updateContractorSchema = z
  .object({
    expectedVersion: z.number().int({ message: "expectedVersion is required for concurrency control" }),
    companyName: z.string().trim().min(1).max(255).optional(),
    tradingName: z.string().trim().max(255).optional().nullable(),
    registrationNumber: z.string().trim().max(100).optional().nullable(),
    registrationType: z.string().trim().max(50).optional().nullable(),
    gstRegistered: z.boolean().optional(),
    status: z.nativeEnum(ContractorStatus).optional(),
    isPreferred: z.boolean().optional(),
    website: z.string().trim().max(255).optional().nullable(),
    mainPhone: z.string().trim().max(50).optional().nullable(),
    mainEmail: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
    addressLine1: z.string().trim().max(255).optional().nullable(),
    addressLine2: z.string().trim().max(255).optional().nullable(),
    suburb: z.string().trim().max(100).optional().nullable(),
    state: z.string().trim().max(50).optional().nullable(),
    postcode: z.string().trim().max(20).optional().nullable(),
    country: z.string().trim().max(50).optional(),
    serviceAreas: z.array(z.string().trim().max(100)).optional(),
    afterHoursAvailable: z.boolean().optional(),
    emergencyPhone: z.string().trim().max(50).optional().nullable(),
    paymentTerms: z.string().trim().max(100).optional().nullable(),
    callOutFee: z.coerce.number().min(0).optional().nullable(),
    hourlyRate: z.coerce.number().min(0).optional().nullable(),
    currency: z.string().trim().max(10).optional(),
    internalNotes: safeTextField(5000).optional().nullable(),
    tradeIds: z.array(z.string().uuid()).optional(),
    primaryTradeId: z.string().uuid().optional().nullable(),
    tags: z.array(z.string().trim().max(50)).optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.registrationNumber !== undefined) {
        return abnRefinement(data.registrationNumber, data.registrationType);
      }
      return true;
    },
    {
      message: "Invalid Australian Business Number (ABN) checksum or format",
      path: ["registrationNumber"],
    }
  );

export const blockContractorSchema = z
  .object({
    reason: safeTextField(1000).refine((v) => (v?.trim().length ?? 0) >= 5, {
      message: "A blocking reason of at least 5 characters is required",
    }),
  })
  .strict();

export const createContactSchema = z
  .object({
    name: z.string().trim().min(1, "Contact name is required").max(255),
    jobTitle: z.string().trim().max(100).optional().nullable(),
    phone: z.string().trim().max(50).optional().nullable(),
    mobile: z.string().trim().max(50).optional().nullable(),
    email: z.string().trim().email("Invalid contact email").max(255).optional().nullable().or(z.literal("")),
    isPrimary: z.boolean().default(false),
    notes: safeTextField(1000).optional().nullable(),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateContactSchema = createContactSchema.partial().strict();

export const createCredentialSchema = z
  .object({
    kind: z.nativeEnum(CredentialKind),
    type: z.string().trim().min(1, "Credential type label is required").max(100),
    issuer: z.string().trim().max(200).optional().nullable(),
    number: z.string().trim().max(100).optional().nullable(),
    coverAmount: z.coerce.number().min(0).optional().nullable(),
    issuedAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    status: z.nativeEnum(CredentialStatus).default(CredentialStatus.VALID).optional(),
    notes: safeTextField(1000).optional().nullable(),
  })
  .strict();

export const updateCredentialSchema = createCredentialSchema.partial().strict();

export const createReviewSchema = z
  .object({
    sevaId: z.string().uuid().optional().nullable(),
    rating: z.coerce.number().int().min(1).max(5),
    qualityRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    timelinessRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    priceRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    wouldUseAgain: z.boolean().default(true),
    comment: safeTextField(2000).optional().nullable(),
  })
  .strict();

export const updateReviewSchema = z
  .object({
    rating: z.coerce.number().int().min(1).max(5).optional(),
    qualityRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    timelinessRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    priceRating: z.coerce.number().int().min(1).max(5).optional().nullable(),
    wouldUseAgain: z.boolean().optional(),
    comment: safeTextField(2000).optional().nullable(),
  })
  .strict();

export const createSevaContractorSchema = z
  .object({
    contractorId: z.string().uuid("Valid contractor ID required"),
    role: z.nativeEnum(SevaContractorRole).default(SevaContractorRole.PRIMARY),
    scope: z.string().trim().max(500).optional().nullable(),
    status: z.nativeEnum(SevaContractorStatus).default(SevaContractorStatus.INVITED),
    quotedAmount: z.coerce.number().min(0).optional().nullable(),
    finalAmount: z.coerce.number().min(0).optional().nullable(),
    invoiceNumber: z.string().trim().max(100).optional().nullable(),
    invoicedAmount: z.coerce.number().min(0).optional().nullable(),
    invoicedAt: z.string().optional().nullable(),
    paidAt: z.string().optional().nullable(),
    confirmWarning: z.boolean().optional().default(false),
  })
  .strict();

export const updateSevaContractorSchema = createSevaContractorSchema.partial().strict();

export const createContractorRequestSchema = z
  .object({
    type: z.nativeEnum(ContractorRequestType),
    contractorId: z.string().uuid().optional().nullable(),
    proposedData: z.record(z.any()),
    note: safeTextField(2000).optional().nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.type === ContractorRequestType.UPDATE_CONTRACTOR && !data.contractorId) {
        return false;
      }
      return true;
    },
    {
      message: "contractorId is required when suggesting a change to an existing contractor",
      path: ["contractorId"],
    }
  );

export const approveContractorRequestSchema = z
  .object({
    acceptedFields: z.array(z.string()).optional(),
    editedData: z.record(z.any()).optional(),
    reviewNote: safeTextField(2000).optional().nullable(),
    expectedContractorVersion: z.number().int().optional(),
    confirmConflict: z.boolean().optional().default(false),
    attachRequestFiles: z.boolean().optional().default(false),
    supportingFileIds: z.array(z.string().uuid()).optional(),
  })
  .strict();

export const rejectContractorRequestSchema = z
  .object({
    reviewNote: safeTextField(2000).refine((val) => (val?.trim().length ?? 0) >= 3, {
      message: "A rejection reason of at least 3 characters is required",
    }),
  })
  .strict();

export const requestMoreInfoSchema = z
  .object({
    reviewNote: safeTextField(2000).refine((val) => (val?.trim().length ?? 0) >= 3, {
      message: "A note specifying what information is needed is required",
    }),
  })
  .strict();

export const createTradeSchema = z
  .object({
    name: z.string().trim().min(1, "Trade name is required").max(100),
    description: z.string().trim().max(500).optional().nullable(),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().default(0),
  })
  .strict();

export const updateTradeSchema = createTradeSchema.partial().strict();

export const setCategoryTradesSchema = z
  .object({
    tradeIds: z.array(z.string().uuid()),
  })
  .strict();

export type CreateContractorInput = z.input<typeof createContractorSchema>;
export type UpdateContractorInput = z.input<typeof updateContractorSchema>;
export type CreateContactInput = z.input<typeof createContactSchema>;
export type UpdateContactInput = z.input<typeof updateContactSchema>;
export type CreateCredentialInput = z.input<typeof createCredentialSchema>;
export type UpdateCredentialInput = z.input<typeof updateCredentialSchema>;
export type CreateReviewInput = z.input<typeof createReviewSchema>;
export type UpdateReviewInput = z.input<typeof updateReviewSchema>;
export type CreateSevaContractorInput = z.input<typeof createSevaContractorSchema>;
export type LinkSevaContractorInput = CreateSevaContractorInput;
export type UpdateSevaContractorInput = z.input<typeof updateSevaContractorSchema>;
export type CreateContractorRequestInput = z.input<typeof createContractorRequestSchema>;
export type ApproveContractorRequestInput = z.input<typeof approveContractorRequestSchema>;
export type RejectContractorRequestInput = z.input<typeof rejectContractorRequestSchema>;
export type RequestMoreInfoInput = z.input<typeof requestMoreInfoSchema>;
export type CreateTradeInput = z.input<typeof createTradeSchema>;
export type UpdateTradeInput = z.input<typeof updateTradeSchema>;
