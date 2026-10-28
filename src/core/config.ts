import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("production"),
  APP_PORT: z.coerce.number().default(8080),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters long"),
  COOKIE_SECURE: z
    .enum(["true", "false", "1", "0"])
    .transform((v) => v === "true" || v === "1")
    .default("false"),
  UPLOAD_DIR: z.string().default("./data/uploads"),
  TZ: z.string().default("Australia/Adelaide"),
  ADMIN_NAME: z.string().default("System Administrator"),
  ADMIN_EMAIL: z.string().email().default("admin@seva.local"),
  ADMIN_PASSWORD: z.string().min(10, "ADMIN_PASSWORD must be at least 10 characters"),
  SEED_DEMO: z
    .enum(["true", "false", "1", "0"])
    .transform((v) => v === "true" || v === "1")
    .default("false"),
  DOMAIN: z.string().optional(),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  NEXT_TELEMETRY_DISABLED: z.string().default("1"),

  // Optional SMTP
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().optional().default("Seva System <no-reply@seva.local>"),
  SMTP_SECURE: z
    .enum(["true", "false", "1", "0"])
    .transform((v) => v === "true" || v === "1")
    .default("false"),
});

export type AppConfig = z.infer<typeof envSchema>;

function parseConfig(): AppConfig {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => ` - [${issue.path.join(".")}] ${issue.message}`)
      .join("\n");
    // In test environment or during static Next.js compilation, allow graceful build defaults
    const isBuildPhase =
      process.env.NODE_ENV === "test" ||
      process.env.npm_lifecycle_event === "build" ||
      process.env.NEXT_PHASE === "phase-production-build";

    if (isBuildPhase) {
      return {
        NODE_ENV: process.env.NODE_ENV === "test" ? "test" : "production",
        APP_PORT: 8080,
        DATABASE_URL: process.env.DATABASE_URL || "postgresql://seva:dummy@localhost:5432/seva_build",
        SESSION_SECRET: "build_secret_must_be_at_least_32_characters_long_for_compilation",
        COOKIE_SECURE: false,
        UPLOAD_DIR: "./data/uploads",
        TZ: "Australia/Adelaide",
        ADMIN_NAME: "System Administrator",
        ADMIN_EMAIL: "admin@seva.local",
        ADMIN_PASSWORD: "AdminSeva2026!ChangeMe",
        SEED_DEMO: false,
        LOG_LEVEL: "info",
        NEXT_TELEMETRY_DISABLED: "1",
        SMTP_PORT: 587,
        SMTP_FROM: "Seva System <no-reply@seva.local>",
        SMTP_SECURE: false,
      };
    }
    throw new Error(`CRITICAL: Invalid environment configuration:\n${issues}`);
  }

  // Refuse default insecure secrets in production
  if (result.data.NODE_ENV === "production") {
    if (result.data.SESSION_SECRET.includes("change_this") || result.data.SESSION_SECRET.includes("default")) {
      throw new Error("CRITICAL: SESSION_SECRET must not use placeholder or default value in production");
    }
  }

  return result.data;
}

export const config = parseConfig();
