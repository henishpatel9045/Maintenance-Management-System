export interface ModuleNavItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  requiredPermission?: string;
  order: number;
}

export interface ModuleManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  navItems: ModuleNavItem[];
  permissionKeys: string[];
  settingsKeys?: string[];
  dashboardWidgets?: string[];
  reportSections?: string[];
  searchProvider?: (query: string, userId: string) => Promise<any[]>;
}

const moduleManifests = new Map<string, ModuleManifest>();

export function registerModule(manifest: ModuleManifest): void {
  moduleManifests.set(manifest.id, manifest);
}

// Auto-register built-in core and feature modules
import { contractorsManifest } from "./contractors/manifest";
import { licencesManifest } from "./licences/manifest";

registerModule(contractorsManifest);
registerModule(licencesManifest);

export function getRegisteredModules(): ModuleManifest[] {
  return Array.from(moduleManifests.values());
}

export function getModuleManifest(id: string): ModuleManifest | undefined {
  return moduleManifests.get(id);
}

export function getActiveNavItems(userPermissions: Set<string>, settings: Record<string, unknown> = {}): ModuleNavItem[] {
  const items: ModuleNavItem[] = [];

  for (const manifest of moduleManifests.values()) {
    // Check feature flag: module.<id>.enabled
    const settingKey = `module.${manifest.id}.enabled`;
    const isEnabled = settings[settingKey] !== false;
    if (!isEnabled) {
      continue;
    }

    for (const nav of manifest.navItems) {
      if (!nav.requiredPermission || userPermissions.has(nav.requiredPermission)) {
        items.push(nav);
      }
    }
  }

  return items.sort((a, b) => a.order - b.order);
}
