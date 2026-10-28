"use client";

import { useState, useEffect } from "react";

export interface CurrentUser {
  id: string;
  name: string;
  email: string | null;
  phone?: string | null;
  role: string;
  permissions: string[];
}

export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.user) {
          setUser(j.data.user);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const hasPermission = (key: string) => {
    if (!user) return false;
    if (user.role === "ADMIN") return true;
    if (user.role === "COORDINATOR") {
      if (
        key === "licences.verify" ||
        key === "licences.manage" ||
        key === "masters.manage" ||
        key === "seva.assign" ||
        key === "contractors.requests.review"
      ) {
        return true;
      }
    }
    return user.permissions.includes(key);
  };

  return { user, loading, hasPermission };
}
