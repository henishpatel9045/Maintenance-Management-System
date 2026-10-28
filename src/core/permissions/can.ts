import { PermissionKey } from "./keys";

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  role: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  permissions: Set<string>;
  settings?: Record<string, unknown>;
}

export interface PermissionContext {
  seva?: {
    id: string;
    assigneeIds?: string[];
    isGroup?: boolean;
  };
  isAssignee?: boolean;
  isOwner?: boolean;
}

export function can(
  user: AuthenticatedUser | null | undefined,
  permission: PermissionKey,
  context?: PermissionContext
): boolean {
  if (!user || !user.isActive) {
    return false;
  }

  // Admin has full superuser authority across all modules
  if (user.role === "ADMIN") {
    return true;
  }

  const isCoordinator = user.role === "COORDINATOR";
  const isMember = user.role === "MEMBER";

  // Coordinators have dynamic master management capabilities and task assignment capabilities
  if (isCoordinator && (permission === "masters.manage" || permission === "seva.assign")) {
    return true;
  }

  const settings = user.settings ?? {};

  // Coordinator licences management & verification capability (when enabled via settings)
  if (
    isCoordinator &&
    Boolean(settings["coordinatorsCanManageLicences"]) &&
    (permission === "licences.manage" || permission === "licences.verify")
  ) {
    return true;
  }

  // Dynamic member directory view toggle
  if (
    isMember &&
    Boolean(settings["membersCanViewLicenceDirectory"]) &&
    permission === "licences.directory.view"
  ) {
    return true;
  }

  // Member submitting own licence requires membersCanSubmitOwnLicences (default true)
  if (isMember && permission === "licences.own.submit") {
    const canSubmit = Boolean(settings["membersCanSubmitOwnLicences"] ?? true);
    if (!canSubmit) {
      return false;
    }
  }

  // Check base permission presence from role & overrides
  if (!user.permissions.has(permission) && !user.permissions.has("*")) {
    return false;
  }

  // Contextual capability adjustments based on system settings and assignment

  // 1. Coordinators creating/editing Seva requires 'coordinatorsCanEditSeva' setting
  if (isCoordinator && (permission === "seva.create" || permission === "seva.update")) {
    const coordinatorsCanEdit = Boolean(settings["coordinatorsCanEditSeva"] ?? false);
    if (!coordinatorsCanEdit) {
      return false;
    }
  }

  // 2. Member viewing Seva when 'membersSeeAllSeva' is false requires being an assignee
  if (isMember && permission === "seva.read") {
    const membersSeeAll = Boolean(settings["membersSeeAllSeva"] ?? true);
    if (!membersSeeAll && context?.seva) {
      const isAssignee = context.isAssignee || (context.seva.assigneeIds?.includes(user.id) ?? false);
      if (!isAssignee) {
        return false;
      }
    }
  }

  // 3. Member updating status on occurrence requires 'assigneesCanUpdateStatus' and being an assignee
  if (isMember && permission === "occurrence.updateStatus") {
    const assigneesCanUpdate = Boolean(settings["assigneesCanUpdateStatus"] ?? true);
    if (!assigneesCanUpdate) {
      return false;
    }
    if (context) {
      const isAssignee = context.isAssignee || (context.seva?.assigneeIds?.includes(user.id) ?? false);
      if (!isAssignee) {
        return false;
      }
    }
  }

  // 4. Member uploading artefacts requires 'membersCanUploadArtefacts' and being assigned
  if (isMember && permission === "artefacts.upload") {
    const membersCanUpload = Boolean(settings["membersCanUploadArtefacts"] ?? true);
    if (!membersCanUpload) {
      return false;
    }
    if (context) {
      const isAssignee = context.isAssignee || (context.seva?.assigneeIds?.includes(user.id) ?? false);
      if (!isAssignee) {
        return false;
      }
    }
  }

  // 5. Member viewing reports requires 'membersCanViewReports'
  if (isMember && permission === "reports.view") {
    const membersCanViewReports = Boolean(settings["membersCanViewReports"] ?? false);
    if (!membersCanViewReports) {
      return false;
    }
  }

  return true;
}
