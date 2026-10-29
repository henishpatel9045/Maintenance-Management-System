"use client";

import React, { useState, useEffect } from "react";
import {
  Shield,
  Users,
  Layers,
  MapPin,
  Tag as TagIcon,
  Settings as SettingsIcon,
  HardDrive,
  Activity,
  Plus,
  KeyRound,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Award,
  Copy,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Edit2,
} from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { Badge } from "@/core/ui-kit/Badge";
import { Tabs } from "@/core/ui-kit/Tabs";
import { Modal } from "@/core/ui-kit/Modal";
import { FormField, inputClass, selectClass } from "@/core/ui-kit/FormField";
import { DataTable, Column } from "@/core/ui-kit/DataTable";
import { format } from "date-fns";
import { AreaManager } from "@/modules/masters/components/AreaManager";
import { UserLicencesManagerModal } from "@/modules/licences/components/UserLicencesManagerModal";

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("users");

  // Users state
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPhone, setNewUserPhone] = useState("");
  const [newUserRole, setNewUserRole] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [selectedUserForLicences, setSelectedUserForLicences] = useState<any | null>(null);

  // Edit User state
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<any | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserRoleId, setEditUserRoleId] = useState("");
  const [editUserActive, setEditUserActive] = useState(true);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [editUserError, setEditUserError] = useState<string | null>(null);

  // Password Reset state
  const [selectedUserForReset, setSelectedUserForReset] = useState<any | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetMustChange, setResetMustChange] = useState(true);
  const [showPasswordText, setShowPasswordText] = useState(true);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetSuccessInfo, setResetSuccessInfo] = useState<{
    userName: string;
    email: string;
    password: string;
    mustChange: boolean;
  } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  // Storage usage
  const [storageStats, setStorageStats] = useState<any>(null);

  // Audit
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Categories & Areas
  const [categories, setCategories] = useState<any[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [isCreateCatOpen, setIsCreateCatOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catColor, setCatColor] = useState("#4f46e5");

  const loadData = async () => {
    fetch("/api/v1/users")
      .then((r) => r.json())
      .then((j) => setUsers(j.data || []))
      .catch(() => {});

    fetch("/api/v1/roles")
      .then((r) => r.json())
      .then((j) => {
        setRoles(j.data || []);
        if (j.data?.[0]) setNewUserRole(j.data[0].id);
      })
      .catch(() => {});

    fetch("/api/v1/settings")
      .then((r) => r.json())
      .then((j) => setSettings(j.data || {}))
      .catch(() => {});

    fetch("/api/v1/files/usage")
      .then((r) => r.json())
      .then((j) => setStorageStats(j.data))
      .catch(() => {});

    fetch("/api/v1/audit?pageSize=30")
      .then((r) => r.json())
      .then((j) => setAuditLogs(j.data || []))
      .catch(() => {});

    fetch("/api/v1/masters/categories")
      .then((r) => r.json())
      .then((j) => setCategories(j.data || []))
      .catch(() => {});

    fetch("/api/v1/masters/areas")
      .then((r) => r.json())
      .then((j) => setAreas(j.data || []))
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          phone: newUserPhone || null,
          roleId: newUserRole,
          password: newUserPassword,
        }),
      });

      if (res.ok) {
        setIsCreateUserOpen(false);
        setNewUserName("");
        setNewUserEmail("");
        setNewUserPhone("");
        setNewUserPassword("");
        loadData();
      }
    } catch {}
  };

  const handleToggleUserActive = async (userId: string, currentActive: boolean) => {
    try {
      await fetch(`/api/v1/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentActive }),
      });
      loadData();
    } catch {}
  };

  const handleOpenEditUser = (u: any) => {
    setSelectedUserForEdit(u);
    setEditUserName(u.name || "");
    setEditUserEmail(u.email || "");
    setEditUserPhone(u.phone || "");
    setEditUserRoleId(u.role?.id || u.roleId || (roles[0]?.id || ""));
    setEditUserActive(u.isActive !== false);
    setEditUserError(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForEdit) return;
    setIsSavingUser(true);
    setEditUserError(null);

    try {
      const res = await fetch(`/api/v1/users/${selectedUserForEdit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editUserName.trim(),
          email: editUserEmail.trim(),
          phone: editUserPhone.trim() || null,
          roleId: editUserRoleId,
          isActive: editUserActive,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setEditUserError(json.error?.message || "Failed to update user details");
        setIsSavingUser(false);
        return;
      }

      setSelectedUserForEdit(null);
      loadData();
    } catch {
      setEditUserError("An error occurred while saving user details");
    } finally {
      setIsSavingUser(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const pick = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    return `Seva-${pick(4)}-${pick(4)}-${pick(4)}`;
  };

  const handleOpenResetPassword = (u: any) => {
    setSelectedUserForReset(u);
    const initialPass = generateRandomPassword();
    setResetPasswordValue(initialPass);
    setResetMustChange(true);
    setResetPasswordError(null);
    setResetSuccessInfo(null);
    setIsCopied(false);
    setShowPasswordText(true);
  };

  const handleSubmitResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    setIsResettingPassword(true);
    setResetPasswordError(null);

    try {
      const res = await fetch(`/api/v1/users/${selectedUserForReset.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          temporaryPassword: resetPasswordValue,
          mustChangePassword: resetMustChange,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setResetPasswordError(json.error?.message || "Failed to reset user password");
        setIsResettingPassword(false);
        return;
      }

      setResetSuccessInfo({
        userName: selectedUserForReset.name,
        email: selectedUserForReset.email || selectedUserForReset.phone || selectedUserForReset.id,
        password: resetPasswordValue,
        mustChange: resetMustChange,
      });
      loadData();
    } catch {
      setResetPasswordError("Network error occurred while resetting password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleCopyPassword = () => {
    if (!resetSuccessInfo?.password) return;
    navigator.clipboard.writeText(resetSuccessInfo.password).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    });
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsSuccess(false);

    try {
      const res = await fetch("/api/v1/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      }
    } catch {
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/v1/masters/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: catName, color: catColor }),
      });
      if (res.ok) {
        setIsCreateCatOpen(false);
        setCatName("");
        loadData();
      }
    } catch {}
  };

  const tabs = [
    { id: "users", label: "Users & Roles", icon: <Users className="w-4 h-4" /> },
    { id: "masters", label: "Categories & Areas", icon: <Layers className="w-4 h-4" /> },
    { id: "settings", label: "System Settings", icon: <SettingsIcon className="w-4 h-4" /> },
    { id: "storage", label: "Storage & Backups", icon: <HardDrive className="w-4 h-4" /> },
    { id: "audit", label: "Audit Trail", icon: <Activity className="w-4 h-4" /> },
  ];

  const userColumns: Column<any>[] = [
    { key: "name", header: "Name" },
    { key: "email", header: "Email Address" },
    {
      key: "role",
      header: "Role",
      render: (u) => <Badge size="sm" variant={u.role?.name === "ADMIN" ? "danger" : "info"}>{u.role?.name}</Badge>,
    },
    {
      key: "isActive",
      header: "Status",
      render: (u) => (
        <Badge size="sm" variant={u.isActive ? "success" : "neutral"}>
          {u.isActive ? "Active" : "Deactivated"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (u) => (
        <div className="flex items-center gap-1.5 justify-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenEditUser(u)}
            icon={<Edit2 className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleOpenResetPassword(u)}
            icon={<KeyRound className="w-3.5 h-3.5 text-amber-600" />}
          >
            Reset Password
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSelectedUserForLicences(u)}
            icon={<Award className="w-3.5 h-3.5 text-indigo-600" />}
          >
            Licences
          </Button>
          <Button
            size="sm"
            variant={u.isActive ? "danger" : "secondary"}
            onClick={() => handleToggleUserActive(u.id, u.isActive)}
          >
            {u.isActive ? "Deactivate" : "Activate"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Shield className="w-6 h-6 text-indigo-600" /> System Administration Console
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          User provisioning, capability controls, master lists, configuration flags, and audit oversight
        </p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab: Users */}
      {activeTab === "users" && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Provisioned Accounts ({users.length})
            </h2>
            <Button size="sm" variant="primary" onClick={() => setIsCreateUserOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
              Create User
            </Button>
          </div>

          <DataTable columns={userColumns} data={users} keyExtractor={(u) => u.id} />
        </div>
      )}

      {/* Tab: Masters */}
      {activeTab === "masters" && (
        <div className="space-y-6">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Categories ({categories.length})</h2>
              <Button size="sm" variant="outline" onClick={() => setIsCreateCatOpen(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                Add Category
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{c.name}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-1">{c.description ? c.description.slice(0, 16) : "—"}</span>
                </div>
              ))}
            </div>
          </div>

          <AreaManager />
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === "settings" && (
        <form onSubmit={handleSaveSettings} className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Global System Settings</h2>
              <p className="text-xs text-slate-500">Fine-tune organizational policies, capability rules, and limits</p>
            </div>
            <Button type="submit" variant="primary" size="sm" isLoading={isSavingSettings}>
              Save Settings
            </Button>
          </div>

          {settingsSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Settings updated successfully
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Organization Name">
              <input
                type="text"
                value={settings["orgName"] || ""}
                onChange={(e) => setSettings({ ...settings, orgName: e.target.value })}
                className={inputClass}
              />
            </FormField>

            <FormField label="Timezone">
              <input
                type="text"
                value={settings["timezone"] || ""}
                onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                className={inputClass}
              />
            </FormField>

            <FormField label="Currency Code">
              <input
                type="text"
                value={settings["currency"] || ""}
                onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                className={inputClass}
              />
            </FormField>

            <FormField label="Recurrence Horizon (Days)">
              <input
                type="number"
                value={settings["recurrenceHorizonDays"] || 90}
                onChange={(e) => setSettings({ ...settings, recurrenceHorizonDays: parseInt(e.target.value, 10) })}
                className={inputClass}
              />
            </FormField>

            <div className="sm:col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">
                Role & Capability Flags
              </span>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings["membersSeeAllSeva"] !== false}
                    onChange={(e) => setSettings({ ...settings, membersSeeAllSeva: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Members can see all community Seva (when disabled, only see assigned)</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings["coordinatorsCanEditSeva"] === true}
                    onChange={(e) => setSettings({ ...settings, coordinatorsCanEditSeva: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Coordinators can create and edit Seva definitions</span>
                </label>

                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings["membersCanUploadArtefacts"] !== false}
                    onChange={(e) => setSettings({ ...settings, membersCanUploadArtefacts: e.target.checked })}
                    className="rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Members can upload completion proof and photos on assigned Seva</span>
                </label>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Tab: Storage & Backups */}
      {activeTab === "storage" && (
        <div className="space-y-4">
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Disk Storage Usage</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-xs text-slate-500">Total Uploaded Files</span>
                <div className="text-xl font-bold mt-1">{storageStats?.totalFilesCount || 0}</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-xs text-slate-500">Disk Space Consumed</span>
                <div className="text-xl font-bold mt-1">{storageStats?.totalSizeMB || "0.00"} MB</div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-xs text-slate-500">Mount Path</span>
                <div className="text-xs font-mono font-bold mt-1 text-indigo-600">./data/uploads</div>
              </div>
            </div>
          </div>

          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Self-Hosted Backups</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              All persistent data resides inside <code className="font-mono text-indigo-600">./data</code>. To execute an automated backup snapshot, run:
            </p>
            <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-xs font-mono overflow-x-auto">
              make backup
            </pre>
            <p className="text-[11px] text-slate-400">
              Generates a timestamped archive containing compressed PostgreSQL dump and uploads under <code className="font-mono">./backups/</code>.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Audit */}
      {activeTab === "audit" && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">System Audit Trail ({auditLogs.length})</h2>
          <div className="space-y-2">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{log.user?.name || "System"}</span>{" "}
                  <span className="text-indigo-600 font-mono text-[11px]">{log.action}</span>{" "}
                  <span className="text-slate-500">on {log.entityType}</span>
                </div>
                <span className="text-[10px] text-slate-400">{format(new Date(log.createdAt), "dd MMM HH:mm:ss")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create User Modal */}
      <Modal isOpen={isCreateUserOpen} onClose={() => setIsCreateUserOpen(false)} title="Provision New User Account">
        <form onSubmit={handleCreateUser} className="space-y-3">
          <FormField label="Full Name" required>
            <input type="text" required value={newUserName} onChange={(e) => setNewUserName(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Email Address" required>
            <input type="email" required value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Phone Number">
            <input type="text" value={newUserPhone} onChange={(e) => setNewUserPhone(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Role" required>
            <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className={selectClass}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>{r.name} - {r.description}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Temporary Password (min 10 chars)" required>
            <input type="password" required value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} className={inputClass} />
          </FormField>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateUserOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Create Account</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      {selectedUserForEdit && (
        <Modal
          isOpen={!!selectedUserForEdit}
          onClose={() => setSelectedUserForEdit(null)}
          title={`Edit User: ${selectedUserForEdit.name}`}
          maxWidth="md"
        >
          <form onSubmit={handleSaveEditUser} className="space-y-3">
            {editUserError && (
              <div className="p-2.5 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{editUserError}</span>
              </div>
            )}
            <FormField label="Full Name" required>
              <input
                type="text"
                required
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Email Address" required>
              <input
                type="email"
                required
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Phone Number">
              <input
                type="text"
                placeholder="Optional mobile / contact number"
                value={editUserPhone}
                onChange={(e) => setEditUserPhone(e.target.value)}
                className={inputClass}
              />
            </FormField>
            <FormField label="Role" required>
              <select
                value={editUserRoleId}
                onChange={(e) => setEditUserRoleId(e.target.value)}
                className={selectClass}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} - {r.description}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Account Status">
              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="editUserActive"
                    checked={editUserActive === true}
                    onChange={() => setEditUserActive(true)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-emerald-600">Active</span>
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="radio"
                    name="editUserActive"
                    checked={editUserActive === false}
                    onChange={() => setEditUserActive(false)}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="font-medium text-slate-500">Deactivated</span>
                </label>
              </div>
            </FormField>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedUserForEdit(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" size="sm" isLoading={isSavingUser}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Category Modal */}
      <Modal isOpen={isCreateCatOpen} onClose={() => setIsCreateCatOpen(false)} title="Create Maintenance Category">
        <form onSubmit={handleCreateCategory} className="space-y-3">
          <FormField label="Category Name" required>
            <input type="text" required value={catName} onChange={(e) => setCatName(e.target.value)} className={inputClass} />
          </FormField>
          <FormField label="Badge Hex Color">
            <input type="color" value={catColor} onChange={(e) => setCatColor(e.target.value)} className="w-16 h-8 rounded cursor-pointer" />
          </FormField>
          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateCatOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" size="sm">Add Category</Button>
          </div>
        </form>
      </Modal>

      {/* User Licences Manager Modal */}
      {selectedUserForLicences && (
        <UserLicencesManagerModal
          userId={selectedUserForLicences.id}
          userName={selectedUserForLicences.name}
          isOpen={!!selectedUserForLicences}
          onClose={() => setSelectedUserForLicences(null)}
        />
      )}

      {/* Password Reset Modal */}
      {selectedUserForReset && (
        <Modal
          isOpen={!!selectedUserForReset}
          onClose={() => {
            setSelectedUserForReset(null);
            setResetSuccessInfo(null);
          }}
          title={resetSuccessInfo ? "Password Reset Successful" : "Reset User Password"}
          maxWidth="md"
        >
          {resetSuccessInfo ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div className="text-xs">
                  <div className="font-semibold text-emerald-900 dark:text-emerald-100">
                    Password updated for {resetSuccessInfo.userName}
                  </div>
                  <div className="text-emerald-700 dark:text-emerald-300 mt-0.5">
                    {resetSuccessInfo.email}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  New Temporary Password
                </label>
                <div className="flex items-center justify-between gap-2 p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-sm font-bold text-slate-900 dark:text-slate-100 select-all">
                  <span className="truncate">{resetSuccessInfo.password}</span>
                  <Button
                    type="button"
                    size="sm"
                    variant={isCopied ? "primary" : "outline"}
                    onClick={handleCopyPassword}
                    icon={isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {isCopied ? "Copied" : "Copy"}
                  </Button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {resetSuccessInfo.mustChange
                    ? "The user will be required to choose a new personal password immediately upon logging in."
                    : "The user can immediately log in using this password."}
                </p>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                All existing active sessions for this user have been invalidated for security. Please share this temporary password securely.
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setSelectedUserForReset(null);
                    setResetSuccessInfo(null);
                  }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitResetPassword} className="space-y-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-slate-900 dark:text-slate-100">
                    {selectedUserForReset.name}
                  </div>
                  <div className="text-slate-500">{selectedUserForReset.email || "No email"}</div>
                </div>
                <Badge size="sm" variant={selectedUserForReset.role?.name === "ADMIN" ? "danger" : "info"}>
                  {selectedUserForReset.role?.name || "MEMBER"}
                </Badge>
              </div>

              {resetPasswordError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{resetPasswordError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Temporary Password (min 10 characters)
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetPasswordValue(generateRandomPassword())}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Generate New
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPasswordText ? "text" : "password"}
                    required
                    minLength={10}
                    value={resetPasswordValue}
                    onChange={(e) => setResetPasswordValue(e.target.value)}
                    className={`${inputClass} pr-10 font-mono`}
                    placeholder="Enter or generate a temporary password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasswordText(!showPasswordText)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showPasswordText ? "Hide password" : "Show password"}
                  >
                    {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Length: {resetPasswordValue.length} chars (minimum 10 required)
                </p>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-lg space-y-2">
                <label className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetMustChange}
                    onChange={(e) => setResetMustChange(e.target.checked)}
                    className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="font-semibold block text-slate-900 dark:text-slate-100">
                      Require password change on next login
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      User will be forced to choose their own personal password as soon as they sign in.
                    </span>
                  </div>
                </label>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Resetting the password will terminate all active sessions for this user. You will need to provide them with the new temporary password.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedUserForReset(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={isResettingPassword}
                  disabled={resetPasswordValue.length < 10}
                  icon={<KeyRound className="w-3.5 h-3.5" />}
                >
                  Reset Password
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
