import { db } from "@/core/db";
import { logAudit } from "@/core/audit/audit";
import { LicenceKind } from "@prisma/client";

export class LicenceTypeService {
  static async getCategories() {
    return await db.licenceCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: { select: { licenceTypes: true } },
      },
    });
  }

  static async getTypes(options?: { activeOnly?: boolean; categoryId?: string }) {
    return await db.licenceType.findMany({
      where: {
        ...(options?.activeOnly ? { isActive: true } : {}),
        ...(options?.categoryId ? { categoryId: options.categoryId } : {}),
      },
      include: {
        category: true,
        _count: { select: { userLicences: true } },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  static async getType(id: string) {
    return await db.licenceType.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  static async createType(
    data: {
      code: string;
      name: string;
      categoryId: string;
      kind?: LicenceKind;
      issuer?: string | null;
      aliases?: string[];
      classes?: string[];
      hasExpiry?: boolean;
      defaultValidityMonths?: number | null;
      requiresNumber?: boolean;
      isHighlySensitive?: boolean;
      minHoldersTarget?: number | null;
      description?: string | null;
      isActive?: boolean;
      sortOrder?: number;
    },
    actorUserId: string
  ) {
    const existing = await db.licenceType.findUnique({ where: { code: data.code } });
    if (existing) {
      throw new Error(`A licence type with code "${data.code}" already exists.`);
    }

    const type = await db.licenceType.create({
      data: {
        code: data.code,
        name: data.name,
        categoryId: data.categoryId,
        kind: data.kind || "LICENCE",
        issuer: data.issuer || null,
        aliases: data.aliases || [],
        classes: data.classes || [],
        hasExpiry: data.hasExpiry !== undefined ? data.hasExpiry : true,
        defaultValidityMonths: data.defaultValidityMonths ?? null,
        requiresNumber: data.requiresNumber !== undefined ? data.requiresNumber : true,
        isHighlySensitive: data.isHighlySensitive || false,
        minHoldersTarget: data.minHoldersTarget ?? null,
        description: data.description || null,
        isActive: data.isActive !== undefined ? data.isActive : true,
        sortOrder: data.sortOrder || 0,
      },
      include: { category: true },
    });

    await logAudit({
      entityType: "LICENCE_TYPE",
      entityId: type.id,
      userId: actorUserId,
      action: "CREATE_LICENCE_TYPE",
      newValue: { code: type.code, name: type.name },
    });

    return type;
  }

  static async updateType(
    id: string,
    data: Partial<{
      name: string;
      categoryId: string;
      kind: LicenceKind;
      issuer: string | null;
      aliases: string[];
      classes: string[];
      hasExpiry: boolean;
      defaultValidityMonths: number | null;
      requiresNumber: boolean;
      isHighlySensitive: boolean;
      minHoldersTarget: number | null;
      description: string | null;
      isActive: boolean;
      sortOrder: number;
    }>,
    actorUserId: string
  ) {
    const updated = await db.licenceType.update({
      where: { id },
      data,
      include: { category: true },
    });

    await logAudit({
      entityType: "LICENCE_TYPE",
      entityId: id,
      userId: actorUserId,
      action: "UPDATE_LICENCE_TYPE",
      newValue: data,
    });

    return updated;
  }

  static async createCategory(
    data: { name: string; sortOrder?: number },
    actorUserId: string
  ) {
    const category = await db.licenceCategory.create({
      data: {
        name: data.name,
        sortOrder: data.sortOrder || 0,
      },
    });

    await logAudit({
      entityType: "LICENCE_CATEGORY",
      entityId: category.id,
      userId: actorUserId,
      action: "CREATE_LICENCE_CATEGORY",
      newValue: { name: category.name },
    });

    return category;
  }

  static async updateCategory(
    id: string,
    data: { name?: string; sortOrder?: number },
    actorUserId: string
  ) {
    const updated = await db.licenceCategory.update({
      where: { id },
      data,
    });

    await logAudit({
      entityType: "LICENCE_CATEGORY",
      entityId: id,
      userId: actorUserId,
      action: "UPDATE_LICENCE_CATEGORY",
      newValue: data,
    });

    return updated;
  }
}
