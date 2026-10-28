import { ModuleManifest } from "../registry";
import { db } from "@/core/db";
import { getLicenceTierContext } from "./tiers";

export const licencesManifest: ModuleManifest = {
  id: "licences",
  name: "Licences and Skills",
  version: "1.0.0",
  description: "Central register of user licences, tickets, certificates, and competencies",
  navItems: [
    {
      id: "licences",
      label: "Licences",
      href: "/licences",
      icon: "Award",
      order: 55,
      requiredPermission: "licences.own.view",
    },
  ],
  permissionKeys: [
    "licences.own.view",
    "licences.own.submit",
    "licences.directory.view",
    "licences.directory.contact",
    "licences.manage",
    "licences.verify",
    "licences.sensitive.view",
    "licences.documents.view",
    "licences.types.manage",
    "licences.seva.require",
    "licences.reports.view",
    "licences.import",
  ],
  settingsKeys: [
    "module.licences.enabled",
    "membersCanSubmitOwnLicences",
    "membersCanViewLicenceDirectory",
    "coordinatorsCanManageLicences",
    "licenceEnforcement",
    "licenceExpiryWarnDays",
    "licenceReminderDays",
    "countPendingAsHolders",
    "licenceSubmitMaxPendingPerUser",
    "licenceSubmitMaxPerDay",
    "licenceImportMaxRows",
    "licenceImportMaxMB",
  ],
  dashboardWidgets: [
    "LicenceExpiringWidget",
    "LicenceBelowTargetWidget",
    "LicencePendingVerificationsWidget",
    "LicenceQuickLookupWidget",
  ],
  reportSections: [
    "LicenceHoldersByType",
    "LicenceExpiryReport",
    "LicenceMatrix",
    "LicenceGapReport",
    "LicencePersonSheet",
    "LicenceSevaCompliance",
    "LicenceTrends",
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

    const hasAnyLicencePerm = Array.from(perms).some((p) => p.startsWith("licences."));
    if (!hasAnyLicencePerm) return [];

    const tierContext = getLicenceTierContext({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      isActive: user.isActive,
      permissions: perms,
    });

    const q = query.trim().toLowerCase();
    const results: any[] = [];

    // 1. Search Licence Types (name and aliases)
    const types = await db.licenceType.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { code: { contains: q, mode: "insensitive" } },
          { aliases: { hasSome: [query.trim()] } },
        ],
      },
      include: { category: true },
      take: 5,
    });

    for (const t of types) {
      results.push({
        id: t.id,
        type: "LICENCE_TYPE",
        title: t.name,
        subtitle: `${t.category.name} • ${t.kind}`,
        linkUrl: `/licences?typeId=${t.id}`,
        status: t.isActive ? "ACTIVE" : "INACTIVE",
      });
    }

    // 2. Search People by Licence (Only if user has directory.view)
    if (tierContext.canDirectoryView || tierContext.canManage) {
      const matchingHolders = await db.userLicence.findMany({
        where: {
          archivedAt: null,
          supersededById: null,
          status: { in: ["VALID", "EXPIRING_SOON"] },
          user: { isActive: true },
          OR: [
            { licenceType: { name: { contains: q, mode: "insensitive" } } },
            { licenceType: { aliases: { hasSome: [query.trim()] } } },
            { class: { contains: q, mode: "insensitive" } },
          ],
        },
        include: {
          user: { select: { id: true, name: true } },
          licenceType: true,
        },
        take: 5,
      });

      for (const h of matchingHolders) {
        results.push({
          id: `${h.userId}_${h.licenceTypeId}`,
          type: "LICENCE_HOLDER",
          title: h.user.name,
          subtitle: `Holds ${h.licenceType.name}${h.class ? ` (${h.class})` : ""}`,
          linkUrl: `/licences?q=${encodeURIComponent(h.user.name)}`,
          status: h.status,
        });
      }
    }

    return results;
  },
};
