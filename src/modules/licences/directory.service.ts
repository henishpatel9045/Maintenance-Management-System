import { db } from "@/core/db";
import { LicenceTierContext, sanitizeUserLicence } from "./tiers";
import { isLicenceValidOnDate } from "./holder";

export interface DirectoryQueryOptions {
  q?: string;
  licenceTypeId?: string;
  categoryId?: string;
  class?: string;
  status?: string;
  expiringWithinDays?: number;
  availability?: string;
  validOn?: string;
  includePending?: boolean;
  hasAll?: string | string[];
  hasAny?: string | string[];
  page?: number;
  limit?: number;
  sort?: string;
  sortDir?: "asc" | "desc";
}

export class DirectoryService {
  /**
   * Search and filter people in the Licences Directory shaped by the caller's capability tier.
   */
  static async queryDirectory(
    options: DirectoryQueryOptions,
    tierContext: LicenceTierContext
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 20));
    const targetDate = options.validOn ? new Date(options.validOn) : new Date();
    const includePending = Boolean(options.includePending);

    // Normalize hasAll and hasAny into arrays of UUIDs
    const parseIds = (val?: string | string[]): string[] => {
      if (!val) return [];
      if (Array.isArray(val)) return val.filter(Boolean);
      return val.split(",").map((s) => s.trim()).filter(Boolean);
    };

    const hasAllTypeIds = parseIds(options.hasAll);
    const hasAnyTypeIds = parseIds(options.hasAny);

    // 1. Fetch active users with their licences and availability
    const users = await db.user.findMany({
      where: {
        isActive: true,
        ...(options.availability ? { availability: { status: options.availability as any } } : {}),
      },
      include: {
        availability: true,
        licences: {
          where: {
            archivedAt: null,
            supersededById: null,
            ...(options.licenceTypeId ? { licenceTypeId: options.licenceTypeId } : {}),
            ...(options.status ? { status: options.status as any } : {}),
            ...(options.class ? { class: { equals: options.class, mode: "insensitive" } } : {}),
          },
          include: {
            licenceType: { include: { category: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    // 2. Filter users in memory based on complex licence rules
    const now = new Date();
    const expiryWindowDate = options.expiringWithinDays
      ? new Date(now.getTime() + options.expiringWithinDays * 24 * 60 * 60 * 1000)
      : null;

    const filteredUsers = users.filter((user) => {
      // Must hold at least one licence matching criteria
      if (user.licences.length === 0) return false;

      // Filter each user's licences against date validity and search filters
      const validLicences = user.licences.filter((lic) => {
        // Category filter
        if (options.categoryId && lic.licenceType.categoryId !== options.categoryId) {
          return false;
        }

        // Expiry window filter
        if (expiryWindowDate) {
          if (!lic.expiresAt) return false;
          const exp = new Date(lic.expiresAt);
          if (exp < now || exp > expiryWindowDate) return false;
        }

        // Date validity check
        if (options.validOn) {
          if (!isLicenceValidOnDate(lic, targetDate, { includePending })) {
            return false;
          }
        }

        return true;
      });

      if (validLicences.length === 0) return false;

      // Check hasAll condition
      if (hasAllTypeIds.length > 0) {
        const userTypeIds = new Set(
          validLicences
            .filter((l) => isLicenceValidOnDate(l, targetDate, { includePending }))
            .map((l) => l.licenceTypeId)
        );
        const hasAll = hasAllTypeIds.every((id) => userTypeIds.has(id));
        if (!hasAll) return false;
      }

      // Check hasAny condition
      if (hasAnyTypeIds.length > 0) {
        const userTypeIds = new Set(
          validLicences
            .filter((l) => isLicenceValidOnDate(l, targetDate, { includePending }))
            .map((l) => l.licenceTypeId)
        );
        const hasAny = hasAnyTypeIds.some((id) => userTypeIds.has(id));
        if (!hasAny) return false;
      }

      // Search term filter: q across name, email (if permitted), licence type name and aliases
      if (options.q && options.q.trim().length > 0) {
        const q = options.q.trim().toLowerCase();
        const matchesName = user.name.toLowerCase().includes(q);
        const matchesEmail =
          tierContext.canDirectoryContact && user.email
            ? user.email.toLowerCase().includes(q)
            : false;

        const matchesLicence = validLicences.some((lic) => {
          const typeNameMatches = lic.licenceType.name.toLowerCase().includes(q);
          const aliasMatches = lic.licenceType.aliases.some((a) => a.toLowerCase().includes(q));
          const codeMatches = lic.licenceType.code.toLowerCase().includes(q);
          const classMatches = lic.class ? lic.class.toLowerCase().includes(q) : false;
          return typeNameMatches || aliasMatches || codeMatches || classMatches;
        });

        if (!matchesName && !matchesEmail && !matchesLicence) {
          return false;
        }
      }

      return true;
    });

    const total = filteredUsers.length;
    const paginatedUsers = filteredUsers.slice((page - 1) * limit, page * limit);

    // 3. Transform and sanitize output strictly according to tier context
    const data = paginatedUsers.map((user) => {
      // Sanitize each licence held
      const sanitizedLicences = user.licences.map((lic) => {
        return sanitizeUserLicence(lic, tierContext);
      });

      // Construct user representation
      const userResult: Record<string, any> = {
        id: user.id,
        name: user.name,
        avatarUrl: null,
        availability: user.availability
          ? {
              status: user.availability.status,
              note: user.availability.note,
              availableUntil: user.availability.availableUntil,
            }
          : { status: "AVAILABLE", note: null, availableUntil: null },
        licences: sanitizedLicences,
      };

      // Add contact tier info only if permitted
      if (tierContext.canDirectoryContact || tierContext.canManage) {
        userResult.phone = user.phone;
        userResult.email = user.email;
      }

      return userResult;
    });

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
