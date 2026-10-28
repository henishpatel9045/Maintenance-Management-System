import { NextRequest } from "next/server";

export function verifyCsrf(request: NextRequest): { valid: boolean; reason?: string } {
  const method = request.method.toUpperCase();
  // Safe HTTP methods do not require CSRF origin checking
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return { valid: true };
  }

  // Sec-Fetch-Site header verification (if provided by browser)
  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site request rejected" };
  }

  // Origin header check
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return { valid: false, reason: "Origin header does not match Host" };
      }
    } catch {
      return { valid: false, reason: "Malformed Origin header" };
    }
  }

  return { valid: true };
}
