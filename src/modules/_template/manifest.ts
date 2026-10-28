import { ModuleManifest } from "../registry";

export const templateManifest: ModuleManifest = {
  id: "template",
  name: "Template Module",
  version: "1.0.0",
  description: "Scaffold template for building new modular capabilities",
  navItems: [
    {
      id: "template",
      label: "Template",
      href: "/template",
      icon: "Layers",
      order: 100,
      requiredPermission: "template.view",
    },
  ],
  permissionKeys: ["template.view", "template.manage"],
  settingsKeys: ["module.template.enabled"],
  dashboardWidgets: ["TemplateWidget"],
  reportSections: ["TemplateReportSection"],
  searchProvider: async (query: string, _userId: string) => {
    return [];
  },
};
