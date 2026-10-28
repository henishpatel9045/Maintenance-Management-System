import { z, ZodType } from "zod";
import { AppError } from "./error";

export async function validateBody<T>(schema: ZodType<T>, request: Request): Promise<T> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", issues);
  }

  return result.data;
}

export function validateQuery<T>(schema: ZodType<T>, url: URL | string): T {
  const parsedUrl = typeof url === "string" ? new URL(url) : url;
  const entries: Record<string, string | string[]> = {};

  for (const [key, value] of parsedUrl.searchParams.entries()) {
    if (key in entries) {
      const existing = entries[key]!;
      if (Array.isArray(existing)) {
        existing.push(value);
      } else {
        entries[key] = [existing, value];
      }
    } else {
      entries[key] = value;
    }
  }

  const result = schema.safeParse(entries);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", "Query validation failed", issues);
  }

  return result.data;
}

export function validateParams<T>(schema: ZodType<T>, params: unknown): T {
  const result = schema.safeParse(params);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new AppError(400, "VALIDATION_ERROR", "Route parameters validation failed", issues);
  }

  return result.data;
}
