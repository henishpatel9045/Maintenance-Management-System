import { db } from "@/core/db";
import { isLicenceValidOnDate } from "./holder";
import { LicenceTierContext, sanitizeUserLicence } from "./tiers";

export interface VolunteerRequirement {
  licenceTypeId: string;
  class?: string;
  minHolders?: number;
}

export interface FindVolunteersParams {
  requirements: VolunteerRequirement[];
  onDate?: string;
  availability?: "AVAILABLE" | "LIMITED" | "UNAVAILABLE";
  includeLimited?: boolean;
  excludeUserIds?: string[];
}

export class VolunteerService {
  /**
   * Find and rank volunteers matching a set of required licences for a specific target date.
   */
  static async findVolunteers(
    params: FindVolunteersParams,
    tierContext: LicenceTierContext
  ) {
    const targetDate = params.onDate ? new Date(params.onDate) : new Date();
    const excludeIds = new Set(params.excludeUserIds || []);
    const includeLimited = params.includeLimited !== false;

    // 1. Fetch all requirement licence types for labels
    const requiredTypeIds = params.requirements.map((r) => r.licenceTypeId);
    const licenceTypes = await db.licenceType.findMany({
      where: { id: { in: requiredTypeIds } },
      select: { id: true, name: true, code: true, classes: true },
    });
    const typeMap = new Map(licenceTypes.map((t) => [t.id, t]));

    // 2. Fetch active users not in exclude list
    const users = await db.user.findMany({
      where: {
        isActive: true,
        id: { notIn: Array.from(excludeIds) },
      },
      include: {
        availability: true,
        licences: {
          where: {
            archivedAt: null,
            supersededById: null,
            licenceTypeId: { in: requiredTypeIds },
          },
          include: { licenceType: true },
        },
      },
    });

    // 3. Fetch upcoming open seva counts for next 7 days for these users
    const now = new Date();
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const upcomingOccurrences = await db.occurrence.findMany({
      where: {
        dueDate: { gte: now, lte: in7Days },
        status: { in: ["PENDING", "IN_PROGRESS"] },
        seva: { isArchived: false },
      },
      include: {
        seva: {
          include: {
            assignees: { select: { userId: true } },
          },
        },
      },
    });

    const userUpcomingSevaCount = new Map<string, number>();
    for (const occ of upcomingOccurrences) {
      if (occ.seva && occ.seva.assignees) {
        for (const a of occ.seva.assignees) {
          userUpcomingSevaCount.set(a.userId, (userUpcomingSevaCount.get(a.userId) || 0) + 1);
        }
      }
    }

    // 4. Evaluate each user against the requirements
    const evaluatedCandidates = users
      .map((user) => {
        const userAvailStatus = user.availability?.status || "AVAILABLE";

        // Availability filter check
        if (params.availability && userAvailStatus !== params.availability) {
          return null;
        }
        if (!includeLimited && userAvailStatus === "LIMITED") {
          return null;
        }

        // Map which requirements the user meets
        const metRequirements: { reqIndex: number; licence: any }[] = [];
        let totalRemainingDays = 0;
        let countedLicences = 0;

        for (let i = 0; i < params.requirements.length; i++) {
          const req = params.requirements[i]!;
          const validLicence = user.licences.find((l) => {
            if (l.licenceTypeId !== req.licenceTypeId) return false;
            return isLicenceValidOnDate(l, targetDate, {
              includePending: false,
              classRequired: req.class,
            });
          });

          if (validLicence) {
            metRequirements.push({ reqIndex: i, licence: validLicence });
            if (validLicence.expiresAt) {
              const diffDays = Math.max(
                0,
                Math.round(
                  (new Date(validLicence.expiresAt).getTime() - targetDate.getTime()) /
                    (24 * 60 * 60 * 1000)
                )
              );
              totalRemainingDays += diffDays;
            } else {
              totalRemainingDays += 9999; // No expiry (White card, etc.)
            }
            countedLicences++;
          }
        }

        const meetsAll = metRequirements.length === params.requirements.length;
        const meetsAny = metRequirements.length > 0;

        // If candidate meets none of the requirements, exclude them
        if (!meetsAny) {
          return null;
        }

        // Calculate availability sort score
        let availScore = 1;
        if (userAvailStatus === "AVAILABLE") availScore = 3;
        else if (userAvailStatus === "LIMITED") availScore = 2;

        const openSevaCount = userUpcomingSevaCount.get(user.id) || 0;
        const avgRemainingDays = countedLicences > 0 ? Math.round(totalRemainingDays / countedLicences) : 0;

        return {
          user,
          meetsAll,
          metCount: metRequirements.length,
          totalRequirements: params.requirements.length,
          availScore,
          openSevaCount,
          avgRemainingDays,
          matchingLicences: metRequirements.map((m) => m.licence),
        };
      })
      .filter(
        (
          c
        ): c is {
          user: any;
          meetsAll: boolean;
          metCount: number;
          totalRequirements: number;
          availScore: number;
          openSevaCount: number;
          avgRemainingDays: number;
          matchingLicences: any[];
        } => c !== null
      );

    // 5. Ranking Sort:
    // Criterion 1: Has all requirements valid on that date (fully qualified first)
    // Criterion 2: Availability (AVAILABLE before LIMITED before UNAVAILABLE)
    // Criterion 3: Fewest open assigned seva in the next 7 days
    // Criterion 4: Longest remaining validity (highest average days)
    evaluatedCandidates.sort((a, b) => {
      // 1. Meets all vs partial
      if (a.meetsAll !== b.meetsAll) {
        return a.meetsAll ? -1 : 1;
      }
      // If both partial, higher metCount first
      if (a.metCount !== b.metCount) {
        return b.metCount - a.metCount;
      }
      // 2. Availability score descending
      if (a.availScore !== b.availScore) {
        return b.availScore - a.availScore;
      }
      // 3. Open seva count ascending (fewer is better)
      if (a.openSevaCount !== b.openSevaCount) {
        return a.openSevaCount - b.openSevaCount;
      }
      // 4. Remaining validity descending (longer is better)
      return b.avgRemainingDays - a.avgRemainingDays;
    });

    // 6. Format summary header
    const fullyQualifiedCount = evaluatedCandidates.filter((c) => c.meetsAll).length;
    const reqNames = params.requirements
      .map((r) => {
        const type = typeMap.get(r.licenceTypeId);
        return type ? (r.class ? `${type.name} (${r.class})` : type.name) : "Licence";
      })
      .join(" and ");

    const summaryText = `${fullyQualifiedCount} ${
      fullyQualifiedCount === 1 ? "person holds" : "people hold"
    } ${reqNames}`;

    // 7. Sanitize output using caller's tier context
    const results = evaluatedCandidates.map((c) => {
      const sanitizedLicences = c.matchingLicences.map((lic) =>
        sanitizeUserLicence(lic, tierContext)
      );

      const candidateObj: Record<string, any> = {
        id: c.user.id,
        name: c.user.name,
        avatarUrl: null,
        meetsAll: c.meetsAll,
        metCount: c.metCount,
        totalRequirements: c.totalRequirements,
        openSevaCount: c.openSevaCount,
        avgRemainingDays: c.avgRemainingDays,
        availability: c.user.availability
          ? {
              status: c.user.availability.status,
              note: c.user.availability.note,
            }
          : { status: "AVAILABLE", note: null },
        licences: sanitizedLicences,
      };

      if (tierContext.canDirectoryContact || tierContext.canManage) {
        candidateObj.phone = c.user.phone;
        candidateObj.email = c.user.email;
      }

      return candidateObj;
    });

    return {
      summaryText,
      fullyQualifiedCount,
      totalMatches: results.length,
      candidates: results,
    };
  }
}
