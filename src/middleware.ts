import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";

  // Strict CSP: no external scripts/styles/fonts, offline-ready
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' blob: data:;
    font-src 'self' data:;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    connect-src 'self';
    worker-src 'self' blob:;
  `.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  // Authenticated route protections & redirects
  const sessionToken = request.cookies.get("seva_session")?.value;
  const isAuthPage = pathname.startsWith("/login");
  const isPublicApi = pathname === "/api/health" || pathname === "/api/ready" || pathname.startsWith("/api/v1/auth/login");
  const isStatic = pathname.startsWith("/_next") || pathname.startsWith("/icons") || pathname === "/manifest.webmanifest" || pathname === "/sw.js" || pathname === "/favicon.ico";

  // Redirect to login if unauthenticated and requesting protected app page
  if (!sessionToken && !isAuthPage && !isPublicApi && !isStatic && !pathname.startsWith("/api/")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect to dashboard if logged in and visiting login page
  if (sessionToken && isAuthPage) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // Apply Security Headers to every response
  response.headers.set("Content-Security-Policy", cspHeader);
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");

  if (isHttps) {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }

  if (pathname === "/sw.js") {
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Content-Type", "application/javascript; charset=utf-8");
  } else if (pathname.startsWith("/api/") || !isStatic) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for static files
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
