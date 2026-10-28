import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const openApiSpec = {
    openapi: "3.1.0",
    info: {
      title: "Seva Maintenance Management System REST API",
      version: "1.0.0",
      description: "Self-hosted, modular maintenance management API for communities and organisations.",
    },
    servers: [{ url: "/api/v1" }],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: "apiKey",
          in: "cookie",
          name: "seva_session",
        },
      },
    },
    security: [{ cookieAuth: [] }],
    paths: {
      "/auth/login": {
        post: {
          summary: "Authenticate user and issue session cookie",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    email: { type: "string", format: "email" },
                    password: { type: "string" },
                  },
                  required: ["email", "password"],
                },
              },
            },
          },
          responses: { 200: { description: "Successful login" }, 401: { description: "Invalid credentials" } },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Sign out current session",
          responses: { 200: { description: "Signed out" } },
        },
      },
      "/auth/me": {
        get: {
          summary: "Get current authenticated user profile and permissions",
          responses: { 200: { description: "Current user profile" } },
        },
      },
      "/seva": {
        get: {
          summary: "List seva tasks with filtering and pagination",
          parameters: [
            { name: "q", in: "query", schema: { type: "string" } },
            { name: "kind", in: "query", schema: { type: "string", enum: ["ONE_TIME", "RECURRING"] } },
            { name: "priority", in: "query", schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH", "URGENT"] } },
            { name: "page", in: "query", schema: { type: "integer", default: 1 } },
            { name: "pageSize", in: "query", schema: { type: "integer", default: 25 } },
          ],
          responses: { 200: { description: "List of seva tasks" } },
        },
        post: {
          summary: "Create a new seva task or project group",
          responses: { 201: { description: "Seva created" } },
        },
      },
      "/seva/{id}": {
        get: {
          summary: "Get seva task details with occurrences and assignees",
          parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
          responses: { 200: { description: "Seva detail" }, 404: { description: "Not found" } },
        },
        patch: {
          summary: "Update seva details with optimistic locking (expectedVersion)",
          responses: { 200: { description: "Updated" }, 409: { description: "Version conflict" } },
        },
      },
      "/dashboard/kpis": {
        get: {
          summary: "Compute dashboard KPIs and chart data",
          responses: { 200: { description: "KPI metrics" } },
        },
      },
      "/reports/export": {
        post: {
          summary: "Export report in PDF, XLSX, or CSV",
          responses: { 200: { description: "Binary file download" } },
        },
      },
      "/search": {
        get: {
          summary: "Global search across sevas, files, and comments",
          parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }],
          responses: { 200: { description: "Search results" } },
        },
      },
    },
  };

  return NextResponse.json(openApiSpec);
}
