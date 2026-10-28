import { defineConfig } from "vitest/config";
import path from "path";

if (process.env.DATABASE_URL?.includes("@db:5432")) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace("@db:5432", "@localhost:5432");
}

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
