import { PrismaClient } from "@prisma/client";
import { logger } from "./logger";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const url =
    process.env.DATABASE_URL?.includes("@db:5432") && process.platform === "win32"
      ? process.env.DATABASE_URL.replace("@db:5432", "@localhost:5432")
      : process.env.DATABASE_URL;

  const client = new PrismaClient({
    datasources: url ? { db: { url } } : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? [
            { emit: "event", level: "query" },
            { emit: "stdout", level: "error" },
            { emit: "stdout", level: "warn" },
          ]
        : [{ emit: "stdout", level: "error" }],
  });

  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (client as any).$on("query", (e: { query: string; duration: number }) => {
      logger.debug({ query: e.query, durationMs: e.duration }, "Database query executed");
    });
  }

  return client;
}

export const db = global.__prisma ?? createPrismaClient();
export const prisma = db;

if (process.env.NODE_ENV !== "production") {
  global.__prisma = db;
}
