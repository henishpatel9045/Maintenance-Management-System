import { db } from "@/core/db";
import { AppError } from "@/core/http/error";
import { logAudit } from "@/core/audit/audit";
import { CreateContactInput, UpdateContactInput } from "./schemas";

export class ContactService {
  public static async getById(id: string) {
    return db.contractorContact.findUnique({ where: { id } });
  }

  public static async list(contractorId: string) {
    return db.contractorContact.findMany({
      where: {
        contractorId,
        isActive: true,
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
  }

  public static async create(contractorId: string, input: CreateContactInput, userId: string = "system") {
    const contractor = await db.contractor.findUnique({ where: { id: contractorId } });
    if (!contractor) throw new AppError(404, "NOT_FOUND", "Contractor not found");

    const existingCount = await db.contractorContact.count({
      where: { contractorId, isActive: true },
    });

    const isPrimary = input.isPrimary ?? existingCount === 0;

    const contact = await db.$transaction(async (tx) => {
      if (isPrimary) {
        await tx.contractorContact.updateMany({
          where: { contractorId, isPrimary: true },
          data: { isPrimary: false },
        });
      }

      return tx.contractorContact.create({
        data: {
          contractorId,
          name: input.name,
          jobTitle: input.jobTitle || null,
          phone: input.phone || null,
          mobile: input.mobile || null,
          email: input.email || null,
          isPrimary,
          notes: input.notes || null,
          isActive: input.isActive ?? true,
        },
      });
    });

    await logAudit({
      entityType: "CONTRACTOR_CONTACT",
      entityId: contact.id,
      userId,
      action: "CREATE_CONTRACTOR_CONTACT",
      newValue: { name: contact.name, contractorId },
    });

    return contact;
  }

  public static async update(contactId: string, input: UpdateContactInput, userId: string) {
    const existing = await db.contractorContact.findUnique({ where: { id: contactId } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Contact not found");

    const updated = await db.$transaction(async (tx) => {
      if (input.isPrimary === true) {
        await tx.contractorContact.updateMany({
          where: { contractorId: existing.contractorId, isPrimary: true, id: { not: contactId } },
          data: { isPrimary: false },
        });
      }

      return tx.contractorContact.update({
        where: { id: contactId },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.mobile !== undefined ? { mobile: input.mobile } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      });
    });

    await logAudit({
      entityType: "CONTRACTOR_CONTACT",
      entityId: contactId,
      userId,
      action: "UPDATE_CONTRACTOR_CONTACT",
      oldValue: { name: existing.name },
      newValue: { name: updated.name, changes: input },
    });

    return updated;
  }

  public static async delete(contactId: string, userId: string) {
    const existing = await db.contractorContact.findUnique({ where: { id: contactId } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Contact not found");

    // Soft delete by setting isActive: false
    const updated = await db.$transaction(async (tx) => {
      const res = await tx.contractorContact.update({
        where: { id: contactId },
        data: { isActive: false, isPrimary: false },
      });

      // If this was primary, nominate the next active contact if one exists
      if (existing.isPrimary) {
        const nextContact = await tx.contractorContact.findFirst({
          where: { contractorId: existing.contractorId, isActive: true, id: { not: contactId } },
          orderBy: { createdAt: "asc" },
        });
        if (nextContact) {
          await tx.contractorContact.update({
            where: { id: nextContact.id },
            data: { isPrimary: true },
          });
        }
      }

      return res;
    });

    await logAudit({
      entityType: "CONTRACTOR_CONTACT",
      entityId: contactId,
      userId,
      action: "DELETE_CONTRACTOR_CONTACT",
      newValue: { isActive: false },
    });

    return updated;
  }

  public static async makePrimary(contactId: string, userId: string = "system") {
    const existing = await db.contractorContact.findUnique({ where: { id: contactId } });
    if (!existing) throw new AppError(404, "NOT_FOUND", "Contact not found");

    const updated = await db.$transaction(async (tx) => {
      await tx.contractorContact.updateMany({
        where: { contractorId: existing.contractorId, isPrimary: true },
        data: { isPrimary: false },
      });

      return tx.contractorContact.update({
        where: { id: contactId },
        data: { isPrimary: true, isActive: true },
      });
    });

    await logAudit({
      entityType: "CONTRACTOR_CONTACT",
      entityId: contactId,
      userId,
      action: "MAKE_PRIMARY_CONTACT",
      newValue: { isPrimary: true },
    });

    return updated;
  }
}
