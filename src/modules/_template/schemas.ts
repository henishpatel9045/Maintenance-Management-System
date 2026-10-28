import { z } from "zod";

export const createTemplateSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().max(1000).optional(),
  })
  .strict();

export const updateTemplateSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(1000).optional(),
  })
  .strict();

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
