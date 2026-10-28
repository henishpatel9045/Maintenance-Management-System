import { ModuleManifest } from "../registry";
import { db } from "@/core/db";
import { getContractorTierContext, sanitizeContractor } from "./tiers";

export const contractorsManifest: ModuleManifest = {
  id: "contractors",
  name: "Contractors",
  version: "1.0.0",
  description: "Central directory of contractors, credentials, reviews, and seva service history",
  navItems: [
    {
      id: "contractors",
      label: "Contractors",
      href: "/contractors",
      icon: "Briefcase",
      order: 45,
      requiredPermission: "contractors.read",
    },
  ],
  permissionKeys: [
    "contractors.read",
    "contractors.readFull",
    "contractors.request",
    "contractors.requests.review",
    "contractors.write",
    "contractors.credentials.view",
    "contractors.credentials.manage",
    "contractors.documents.view",
    "contractors.documents.manage",
    "contractors.reviews.write",
    "contractors.assign",
    "contractors.import",
    "contractors.manage",
  ],
  settingsKeys: [
    "module.contractors.enabled",
    "membersCanViewContractorRates",
    "contractorExpiryWarnDays",
    "contractorReminderDays",
    "contractorRequestMaxOpenPerUser",
    "contractorRequestMaxPerDay",
    "contractorRequestReminderDays",
    "contractorImportMaxRows",
    "contractorImportMaxMB",
  ],
  dashboardWidgets: [
    "ContractorExpiringCredentialsWidget",
    "ContractorSpendWidget",
    "ContractorRequestsWidget",
  ],
  reportSections: [
    "ContractorDirectory",
    "ContractorExpiry",
    "ContractorSpend",
    "ContractorPerformance",
    "ContractorProfile",
    "ContractorRequests",
  ],
  searchProvider: async (query: string, userId: string) => {
    if (!query || query.trim().length < 2) return [];

    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        role: { include: { permissions: true } },
        permissionOverrides: true,
      },
    });
    if (!user || !user.isActive) return [];

    const perms = new Set<string>();
    user.role.permissions.forEach((p) => perms.add(p.permissionKey));
    user.permissionOverrides.forEach((o) => {
      if (o.granted) perms.add(o.permissionKey);
      else perms.delete(o.permissionKey);
    });

    if (!perms.has("contractors.read")) return [];

    const tierContext = getContractorTierContext({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      permissions: perms,
    });

    const q = query.trim();
    const contractors = await db.contractor.findMany({
      where: {
        archivedAt: null,
        OR: [
          { companyName: { contains: q, mode: "insensitive" } },
          { tradingName: { contains: q, mode: "insensitive" } },
          { registrationNumber: { contains: q, mode: "insensitive" } },
          { mainPhone: { contains: q } },
          { contacts: { some: { name: { contains: q, mode: "insensitive" } } } },
        ],
      },
      include: {
        trades: { include: { trade: true } },
        contacts: { where: { isActive: true } },
      },
      take: 10,
    });

    return contractors.map((c) => {
      const sanitized = sanitizeContractor(c, tierContext);
      const tradesLabel = sanitized.trades.map((t: any) => t.trade.name).join(", ");
      return {
        id: sanitized.id,
        type: "CONTRACTOR",
        title: sanitized.companyName,
        subtitle: tradesLabel ? `${sanitized.code} • ${tradesLabel}` : sanitized.code,
        linkUrl: `/contractors/${sanitized.id}`,
        status: sanitized.status,
      };
    });
  },
};
