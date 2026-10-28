import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { isLicenceValidOnDate } from "./holder";

export interface SevaRequirementInput {
  licenceTypeId: string;
  classRequired?: string | null;
  minHolders?: number;
}

export class SevaLicenceService {
  /**
   * Retrieves required licences for a seva.
   */
  static async getSevaRequiredLicences(sevaId: string) {
    return await db.sevaRequiredLicence.findMany({
      where: { sevaId },
      include: {
        licenceType: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Updates required licences for a seva.
   */
  static async setSevaRequiredLicences(
    sevaId: string,
    requirements: SevaRequirementInput[],
    userId: string
  ) {
    const seva = await db.seva.findUnique({ where: { id: sevaId } });
    if (!seva) throw new Error("Seva task not found.");

    return await db.$transaction(async (tx) => {
      // 1. Delete existing requirements
      await tx.sevaRequiredLicence.deleteMany({
        where: { sevaId },
      });

      // 2. Insert new requirements
      const created = [];
      for (const req of requirements) {
        const item = await tx.sevaRequiredLicence.create({
          data: {
            sevaId,
            licenceTypeId: req.licenceTypeId,
            classRequired: req.classRequired || "",
            minHolders: req.minHolders || 1,
            createdById: userId,
          },
          include: { licenceType: true },
        });
        created.push(item);
      }

      await logAudit({
        entityType: "SEVA",
        entityId: sevaId,
        userId,
        action: "UPDATE_SEVA_REQUIRED_LICENCES",
        newValue: { requirementsCount: created.length },
      });

      return created;
    });
  }

  /**
   * Evaluates current assignees against the seva's licence requirements for a specific target date
   * (e.g. the seva's next due date).
   */
  static async checkSevaLicenceCompliance(sevaId: string, targetDateOverride?: Date) {
    const seva = await db.seva.findUnique({
      where: { id: sevaId },
      include: {
        requiredLicences: {
          include: { licenceType: true },
        },
        assignees: {
          include: {
            user: {
              include: {
                licences: {
                  where: {
                    archivedAt: null,
                    supersededById: null,
                  },
                  include: { licenceType: true },
                },
              },
            },
          },
        },
        occurrences: {
          where: { status: { in: ["PENDING", "IN_PROGRESS"] } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
      },
    });

    if (!seva) {
      throw new Error("Seva task not found.");
    }

    // Determine target evaluation date: override > next occurrence due date > seva due date > today
    let evalDate = targetDateOverride;
    if (!evalDate) {
      if (seva.occurrences.length > 0 && seva.occurrences[0]?.dueDate) {
        evalDate = new Date(seva.occurrences[0].dueDate);
      } else if (seva.dueDate) {
        evalDate = new Date(seva.dueDate);
      } else {
        evalDate = new Date();
      }
    }

    const formattedDate = evalDate.toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

    // If no requirements, trivially compliant
    if (seva.requiredLicences.length === 0) {
      return {
        hasRequirements: false,
        isCompliant: true,
        enforcementMode: "WARN",
        bannerMessage: null,
        targetDate: evalDate.toISOString(),
        requirements: [],
      };
    }

    // Read enforcement setting
    const enforcementSetting = await db.setting.findUnique({
      where: { key: "licenceEnforcement" },
    });
    const enforcementMode = (enforcementSetting?.value as string) || "WARN";

    const requirementEvaluations = seva.requiredLicences.map((req) => {
      const qualifyingHolders: { userId: string; name: string; licenceId: string; expiresAt?: Date | null }[] = [];

      for (const a of seva.assignees) {
        if (!a.user.isActive) continue;

        const validLicence = a.user.licences.find((l) => {
          if (l.licenceTypeId !== req.licenceTypeId) return false;
          return isLicenceValidOnDate(l, evalDate, {
            includePending: false,
            classRequired: req.classRequired || null,
          });
        });

        if (validLicence) {
          qualifyingHolders.push({
            userId: a.user.id,
            name: a.user.name,
            licenceId: validLicence.id,
            expiresAt: validLicence.expiresAt,
          });
        }
      }

      const isMet = qualifyingHolders.length >= req.minHolders;

      return {
        requirementId: req.id,
        licenceTypeId: req.licenceTypeId,
        licenceTypeName: req.licenceType.name,
        classRequired: req.classRequired || null,
        minHolders: req.minHolders,
        currentHoldersCount: qualifyingHolders.length,
        isMet,
        holders: qualifyingHolders,
      };
    });

    const isCompliant = requirementEvaluations.every((r) => r.isMet);

    // Format human-friendly banner message
    let bannerMessage: string;
    if (isCompliant) {
      bannerMessage = `Requirement met by assignees for due date ${formattedDate}`;
    } else {
      const missing = requirementEvaluations.filter((r) => !r.isMet);
      const missingDescriptions = missing.map((m) => {
        const classInfo = m.classRequired ? ` (${m.classRequired})` : "";
        if (m.currentHoldersCount === 0) {
          return `Nobody assigned holds ${m.licenceTypeName}${classInfo}`;
        }
        return `Only ${m.currentHoldersCount} of ${m.minHolders} assigned hold ${m.licenceTypeName}${classInfo}`;
      });
      bannerMessage = `${missingDescriptions.join(", ")} (valid on ${formattedDate})`;
    }

    return {
      hasRequirements: true,
      isCompliant,
      enforcementMode,
      bannerMessage,
      targetDate: evalDate.toISOString(),
      requirements: requirementEvaluations,
    };
  }
}
