import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { SESSION_COOKIE_NAME, validateSession } from "../auth/session";
import { PermissionKey } from "../permissions/keys";
import { can, AuthenticatedUser, PermissionContext } from "../permissions/can";
import { verifyCsrf } from "./csrf";
import { AppError, errorResponse } from "./error";
import { logger } from "../logger";

export interface WithAuthOptions {
  permission?: PermissionKey;
  requireAuth?: boolean;
  getContext?: (req: NextRequest, params: unknown) => Promise<PermissionContext> | PermissionContext;
}

export type AuthenticatedRouteHandler<TParams = unknown> = (
  req: NextRequest,
  context: {
    user: AuthenticatedUser;
    session: { id: string; userId: string };
    params: TParams;
    requestId: string;
  }
) => Promise<Response>;

export function withAuth<TParams = Record<string, string | string[]>>(
  options: WithAuthOptions | PermissionKey | undefined,
  handler: AuthenticatedRouteHandler<TParams>
) {
  const opts: WithAuthOptions =
    typeof options === "string" ? { permission: options } : (options ?? {});
  const requireAuth = opts.requireAuth !== false;

  return async (
    req: NextRequest,
    segmentData: { params: Promise<TParams> }
  ): Promise<Response> => {
    const requestId = crypto.randomUUID();
    const reqLogger = logger.child({
      requestId,
      method: req.method,
      path: req.nextUrl.pathname,
    });

    try {
      // 1. CSRF Verification for state-changing HTTP requests
      const csrfCheck = verifyCsrf(req);
      if (!csrfCheck.valid) {
        reqLogger.warn({ reason: csrfCheck.reason }, "CSRF check failed");
        return errorResponse(403, "CSRF_ERROR", csrfCheck.reason || "Forbidden", undefined, requestId);
      }

      // 2. Resolve route params (supporting Next.js 15 Promise params)
      let resolvedParams: TParams = {} as TParams;
      if (segmentData?.params) {
        resolvedParams = await Promise.resolve(segmentData.params);
      }

      // 3. Extract and validate session
      const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
      if (!token && requireAuth) {
        return errorResponse(401, "UNAUTHORIZED", "Authentication required to access this resource", undefined, requestId);
      }

      let authResult: Awaited<ReturnType<typeof validateSession>> = null;
      if (token) {
        authResult = await validateSession(token);
        if (!authResult && requireAuth) {
          const resp = errorResponse(401, "SESSION_EXPIRED", "Session has expired or is invalid", undefined, requestId);
          resp.cookies.delete(SESSION_COOKIE_NAME);
          return resp;
        }
      }

      if (!authResult && requireAuth) {
        return errorResponse(401, "UNAUTHORIZED", "Authentication required", undefined, requestId);
      }

      const user = authResult?.user ?? {
        id: "anonymous",
        name: "Anonymous",
        email: null,
        phone: null,
        role: "ANONYMOUS",
        isActive: false,
        mustChangePassword: false,
        permissions: new Set<string>(),
        settings: {},
      };

      const session = authResult?.session ?? {
        id: "anonymous",
        userId: "anonymous",
      };

      // 4. Permission enforcement
      if (opts.permission) {
        let permContext: PermissionContext | undefined;
        if (opts.getContext) {
          permContext = await opts.getContext(req, resolvedParams);
        }

        if (!can(user, opts.permission, permContext)) {
          reqLogger.warn(
            { userId: user.id, permission: opts.permission },
            "Permission denied for user"
          );
          return errorResponse(
            403,
            "FORBIDDEN",
            `User lacks required permission: ${opts.permission}`,
            undefined,
            requestId
          );
        }
      }

      // 5. Invoke actual route handler
      return await handler(req, {
        user,
        session,
        params: resolvedParams,
        requestId,
      });
    } catch (err: unknown) {
      if (err instanceof AppError) {
        reqLogger.info({ code: err.code, message: err.message }, "Application error occurred");
        return errorResponse(err.statusCode, err.code, err.message, err.details, requestId);
      }

      reqLogger.error({ err }, "Unhandled server error processing request");
      return errorResponse(500, "INTERNAL_SERVER_ERROR", "An unexpected server error occurred", undefined, requestId);
    }
  };
}
