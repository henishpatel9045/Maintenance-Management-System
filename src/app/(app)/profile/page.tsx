"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Lock, KeyRound, LogOut, CheckCircle2, ShieldAlert, Award } from "lucide-react";
import { Button } from "@/core/ui-kit/Button";
import { FormField, inputClass } from "@/core/ui-kit/FormField";
import { Badge } from "@/core/ui-kit/Badge";

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => r.json())
      .then((j) => setUser(j.data?.user))
      .catch(() => {});
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    if (newPassword.length < 10) {
      setError("New password must be at least 10 characters long");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/v1/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error?.message || "Failed to update password");
        setIsLoading(false);
        return;
      }

      setMessage("Password updated successfully. Other active sessions were invalidated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      setError("Network error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOutAll = async () => {
    try {
      await fetch("/api/v1/auth/logout-all", { method: "POST" });
      router.push("/login");
    } catch {}
  };

  if (!user) {
    return <div className="p-8 text-center text-sm text-slate-400">Loading user profile...</div>;
  }

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <User className="w-6 h-6 text-indigo-600" /> User Profile & Security
        </h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your account credentials, security sessions, and authorization roles
        </p>
      </div>

      {/* Account Info Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
            {user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{user.name}</div>
            <div className="text-xs text-slate-500">{user.email || "No email"}</div>
            <div className="mt-1">
              <Badge size="sm" variant={user.role === "ADMIN" ? "danger" : "info"}>
                {user.role}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* My Licences & Availability Shortcut Card */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100">My Licences & Availability</div>
            <div className="text-xs text-slate-500">Submit qualifications, renew tickets, and manage volunteer availability</div>
          </div>
        </div>
        <Link href="/licences">
          <Button size="sm" variant="outline">
            Open Portal
          </Button>
        </Link>
      </div>

      {/* Change Password Card */}
      <form
        onSubmit={handleChangePassword}
        className="p-4 sm:p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm space-y-4"
      >
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          <KeyRound className="w-4 h-4 text-indigo-600" /> Change Passphrase
        </div>

        {message && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 rounded-lg text-xs font-medium flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {message}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300 rounded-lg text-xs font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-600" /> {error}
          </div>
        )}

        <FormField label="Current Password" required>
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <FormField label="New Password (min 10 characters)" required>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <FormField label="Confirm New Password" required>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
        </FormField>

        <div className="flex justify-end pt-2">
          <Button type="submit" variant="primary" size="sm" isLoading={isLoading}>
            Update Password
          </Button>
        </div>
      </form>

      {/* Revoke All Sessions */}
      <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex items-center justify-between">
        <div>
          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">Sign Out of All Devices</div>
          <p className="text-[11px] text-slate-500">
            Revoke all active browser sessions across phones, tablets and computers.
          </p>
        </div>
        <Button size="sm" variant="danger" onClick={handleSignOutAll} icon={<LogOut className="w-3.5 h-3.5" />}>
          Sign Out All
        </Button>
      </div>
    </div>
  );
}
