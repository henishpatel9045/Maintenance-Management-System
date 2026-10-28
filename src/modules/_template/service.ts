import { CreateTemplateInput, UpdateTemplateInput } from "./schemas";
import { logAudit } from "../../core/audit/audit";

export class TemplateService {
  public static async create(input: CreateTemplateInput, userId: string) {
    await logAudit({
      entityType: "TEMPLATE",
      entityId: "temp-id",
      userId,
      action: "CREATE_TEMPLATE",
      newValue: input,
    });
    return { id: "template-id", ...input, createdAt: new Date() };
  }

  public static async list() {
    return [];
  }
}
