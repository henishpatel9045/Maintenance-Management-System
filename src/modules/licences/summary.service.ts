import { db } from "@/core/db";
import { countValidHolders, isLicenceValidOnDate } from "./holder";
import { LicenceTierContext, sanitizeUserLicence } from "./tiers";

export class SummaryService {
  /**
   * Retrieves summary counts and target progress for every licence type.
   */
  static async getSummary(onDate: Date = new Date(), includePending: boolean = false) {
    const types = await db.licenceType.findMany({
      where: { isActive: true },
      include: {
        category: true,
        snapshots: {
          orderBy: { takenOn: "desc" },
          take: 12,
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Fetch all active licences for active users
    const allLicences = await db.userLicence.findMany({
      where: {
        archivedAt: null,
        supersededById: null,
        user: { isActive: true },
      },
      include: {
        user: { select: { id: true, isActive: true } },
      },
    });

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const distinctUsersWithLicence = new Set<string>();
    let totalValidLicencesCount = 0;
    let totalExpiringSoonCount = 0;
    let belowTargetTypesCount = 0;

    const summaryCards = types.map((type) => {
      const typeLicences = allLicences.filter((l) => l.licenceTypeId === type.id);

      // Distinct valid holders (each active user counts once per type)
      const validHolders = countValidHolders(typeLicences, onDate, { includePending });

      // Expiring soon: valid on date but expires within 30 days
      const expiringSoon = typeLicences.filter((l) => {
        if (!isLicenceValidOnDate(l, onDate, { includePending })) return false;
        if (!l.expiresAt) return false;
        const exp = new Date(l.expiresAt);
        return exp >= now && exp <= thirtyDaysFromNow;
      }).length;

      // Expired count
      const expired = typeLicences.filter((l) => {
        if (l.status === "EXPIRED") return true;
        if (!l.expiresAt) return false;
        return new Date(l.expiresAt) < now;
      }).length;

      // Pending count
      const pending = typeLicences.filter((l) => l.status === "PENDING_VERIFICATION").length;

      // Target evaluation
      const target = type.minHoldersTarget;
      const belowTarget = target !== null && target > 0 && validHolders < target;
      const shortfall = belowTarget ? target - validHolders : 0;
      const progressPercent = target && target > 0 ? Math.min(100, Math.round((validHolders / target) * 100)) : 100;

      if (belowTarget) {
        belowTargetTypesCount++;
      }

      // Track global stats
      totalExpiringSoonCount += expiringSoon;
      totalValidLicencesCount += validHolders;

      for (const lic of typeLicences) {
        if (isLicenceValidOnDate(lic, onDate, { includePending })) {
          distinctUsersWithLicence.add(lic.userId);
        }
      }

      // Sparkline points (ordered chronologically from oldest to newest)
      const sparkline = (type.snapshots || [])
        .slice()
        .reverse()
        .map((s) => ({
          date: s.takenOn.toISOString().split("T")[0],
          validHolders: s.validHolders,
        }));

      return {
        id: type.id,
        code: type.code,
        name: type.name,
        category: type.category.name,
        kind: type.kind,
        isHighlySensitive: type.isHighlySensitive,
        validHolders,
        expiringSoon,
        expired,
        pending,
        minHoldersTarget: target,
        belowTarget,
        shortfall,
        progressPercent,
        sparkline,
      };
    });

    return {
      counters: {
        totalPeopleWithLicence: distinctUsersWithLicence.size,
        totalValidLicences: totalValidLicencesCount,
        totalExpiringSoon: totalExpiringSoonCount,
        totalBelowTargetTypes: belowTargetTypesCount,
      },
      types: summaryCards,
    };
  }

  /**
   * Returns the list of people holding a specific licence type, sanitized by tier.
   */
  static async getHoldersForType(
    licenceTypeId: string,
    tierContext: LicenceTierContext,
    onDate: Date = new Date(),
    includePending: boolean = false
  ) {
    const licences = await db.userLicence.findMany({
      where: {
        licenceTypeId,
        archivedAt: null,
        supersededById: null,
        user: { isActive: true },
      },
      include: {
        user: {
          include: { availability: true },
        },
        licenceType: { include: { category: true } },
      },
      orderBy: [{ expiresAt: "asc" }, { createdAt: "desc" }],
    });

    const validHolders = licences.filter((l) =>
      isLicenceValidOnDate(l, onDate, { includePending })
    );

    return validHolders.map((lic) => {
      const sanitized = sanitizeUserLicence(lic, tierContext);
      return {
        ...sanitized,
        user: {
          id: lic.user.id,
          name: lic.user.name,
          avatarUrl: null,
          ...(tierContext.canDirectoryContact || tierContext.canManage
            ? { email: lic.user.email, phone: lic.user.phone }
            : {}),
          availability: lic.user.availability
            ? {
                status: lic.user.availability.status,
                note: lic.user.availability.note,
              }
            : { status: "AVAILABLE", note: null },
        },
      };
    });
  }

  /**
   * Generates the Licence Matrix (Users as rows x Licence Types as columns).
   */
  static async getMatrix(
    categoryId: string | undefined,
    tierContext: LicenceTierContext,
    onDate: Date = new Date()
  ) {
    // 1. Fetch Types
    const types = await db.licenceType.findMany({
      where: {
        isActive: true,
        ...(categoryId ? { categoryId } : {}),
      },
      include: { category: true },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    });

    // 2. Fetch Users with Licences
    const users = await db.user.findMany({
      where: { isActive: true },
      include: {
        availability: true,
        licences: {
          where: {
            archivedAt: null,
            supersededById: null,
            ...(categoryId ? { licenceType: { categoryId } } : {}),
          },
          include: { licenceType: true },
        },
      },
      orderBy: { name: "asc" },
    });

    const columns = types.map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      category: t.category.name,
      isHighlySensitive: t.isHighlySensitive,
    }));

    const rows = users
      .filter((u) => u.licences.length > 0) // only include users with at least 1 licence
      .map((u) => {
        const userObj: Record<string, any> = {
          userId: u.id,
          userName: u.name,
          availability: u.availability ? u.availability.status : "AVAILABLE",
          cells: {} as Record<string, any>,
        };

        if (tierContext.canDirectoryContact || tierContext.canManage) {
          userObj.email = u.email;
          userObj.phone = u.phone;
        }

        for (const t of types) {
          const matchingLicence = u.licences.find((l) => l.licenceTypeId === t.id);
          if (!matchingLicence) {
            userObj.cells[t.id] = { status: "NONE" };
            continue;
          }

          const isValid = isLicenceValidOnDate(matchingLicence, onDate, { includePending: false });

          userObj.cells[t.id] = {
            licenceId: matchingLicence.id,
            status: matchingLicence.status,
            isValid,
            class: matchingLicence.class || null,
            expiryMonthYear: !t.isHighlySensitive && matchingLicence.expiresAt
              ? matchingLicence.expiresAt.toISOString().slice(0, 7)
              : null,
          };
        }

        return userObj;
      });

    return { columns, rows };
  }

  /**
   * Retrieves trend data for charts from weekly snapshots.
   */
  static async getTrends(typeId?: string, fromDate?: string, toDate?: string) {
    const from = fromDate ? new Date(fromDate) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const to = toDate ? new Date(toDate) : new Date();

    const snapshots = await db.licenceCountSnapshot.findMany({
      where: {
        ...(typeId ? { licenceTypeId: typeId } : {}),
        takenOn: { gte: from, lte: to },
      },
      include: { licenceType: true },
      orderBy: { takenOn: "asc" },
    });

    return snapshots.map((s) => ({
      date: s.takenOn.toISOString().split("T")[0],
      licenceTypeId: s.licenceTypeId,
      licenceTypeName: s.licenceType.name,
      validHolders: s.validHolders,
      expiringSoon: s.expiringSoon,
      expired: s.expired,
      pending: s.pending,
    }));
  }
}
