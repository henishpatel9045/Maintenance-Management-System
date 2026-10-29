"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  CheckSquare,
  Calendar,
  FolderTree,
  FileQuestion,
  FileBarChart2,
  Settings,
  Bell,
  Search,
  LogOut,
  User as UserIcon,
  Moon,
  Sun,
  Menu,
  X,
  Shield,
  Layers,
  MapPin,
  Briefcase,
  Award,
} from "lucide-react";
import { AuthenticatedUser } from "@/core/permissions/can";

export interface AppShellProps {
  user: AuthenticatedUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [darkMode, setDarkMode] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Initialize theme
  useEffect(() => {
    const isDark =
      localStorage.getItem("theme") === "dark" ||
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
    setDarkMode(isDark);
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
  }, []);

  const toggleTheme = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Poll notifications
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const res = await fetch("/api/v1/notifications");
        if (res.ok) {
          const json = await res.json();
          setNotifications(json.data.notifications || []);
          setUnreadCount(json.data.unreadCount || 0);
        }
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const json = await res.json();
          setSearchResults(json.data || []);
        }
      } catch {}
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleLogout = async () => {
    await fetch("/api/v1/auth/logout", { method: "POST" });
    router.push("/login");
  };

  const navItems = [
    { label: "Dashboard", href: "/", icon: <LayoutDashboard className="w-4 h-4" /> },
    { label: "Seva Sheet", href: "/seva", icon: <ClipboardList className="w-4 h-4" /> },
    { label: "My Seva", href: "/my-seva", icon: <CheckSquare className="w-4 h-4" /> },
    { label: "Upcoming", href: "/upcoming", icon: <Calendar className="w-4 h-4" /> },
    { label: "File Library", href: "/files", icon: <FolderTree className="w-4 h-4" /> },
    { label: "Requests", href: "/requests", icon: <FileQuestion className="w-4 h-4" /> },
    { label: "Reports", href: "/reports", icon: <FileBarChart2 className="w-4 h-4" /> },
    ...(user.settings?.["module.contractors.enabled"] !== false &&
    (user.role === "ADMIN" || user.role === "COORDINATOR" || user.permissions.has("contractors.read"))
      ? [{ label: "Contractors", href: "/contractors", icon: <Briefcase className="w-4 h-4" /> }]
      : []),
    ...(user.settings?.["module.licences.enabled"] !== false &&
    (user.role === "ADMIN" ||
      user.role === "COORDINATOR" ||
      user.permissions.has("licences.own.view") ||
      user.permissions.has("licences.directory.view") ||
      user.permissions.has("licences.manage"))
      ? [{ label: "Licences", href: "/licences", icon: <Award className="w-4 h-4" /> }]
      : []),
    ...(user.role === "ADMIN" || user.role === "COORDINATOR" || user.permissions.has("masters.manage")
      ? [{ label: "Areas", href: "/areas", icon: <MapPin className="w-4 h-4" /> }]
      : []),
    ...(user.role === "ADMIN" || user.role === "COORDINATOR" || user.permissions.has("users.manage") || user.permissions.has("settings.manage")
      ? [{ label: "Admin", href: "/admin", icon: <Shield className="w-4 h-4" /> }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-base shadow-sm">
              S
            </div>
            <span className="font-bold text-base tracking-tight hidden sm:inline">
              Seva <span className="text-indigo-600 dark:text-indigo-400">Maintenance</span>
            </span>
          </Link>
        </div>

        {/* Global Search Bar (Desktop) */}
        <div className="relative hidden md:block max-w-md w-full mx-4">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Quick search sevas, documents, comments (Ctrl+K)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-indigo-500 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:bg-white dark:focus:bg-slate-900 transition-all"
          />

          {/* Quick Search Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 max-h-80 overflow-y-auto">
              {searchResults.map((r) => (
                <Link
                  key={`${r.type}-${r.id}`}
                  href={r.linkUrl}
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                  }}
                  className="block px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 border-b border-slate-100 dark:border-slate-800 last:border-b-0 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{r.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{r.subtitle}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Search Button */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="md:hidden p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Toggle Light/Dark Theme"
          >
            {darkMode ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </button>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {/* Notifications Dropdown */}
            {notificationsOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-3 z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Notifications ({unreadCount} unread)
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={async () => {
                        await fetch("/api/v1/notifications/read-all", { method: "POST" });
                        setUnreadCount(0);
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 mt-1">
                  {notifications.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">No notifications</p>
                  ) : (
                    notifications.map((n) => (
                      <Link
                        key={n.id}
                        href={n.linkUrl || "#"}
                        onClick={() => setNotificationsOpen(false)}
                        className={`block py-2 px-1 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded ${
                          !n.readAt ? "font-semibold" : "opacity-80"
                        }`}
                      >
                        <div className="text-xs text-slate-900 dark:text-slate-100">{n.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{n.body}</div>
                      </Link>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Menu & Profile */}
          <Link
            href="/profile"
            className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="text-left hidden lg:block">
              <div className="text-xs font-semibold leading-tight">{user.name}</div>
              <div className="text-[10px] text-slate-400 leading-tight">{user.role}</div>
            </div>
          </Link>

          {/* Sign Out */}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto pb-16 md:pb-6">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex flex-col w-56 p-4 border-r border-slate-200 dark:border-slate-800 space-y-1 shrink-0">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-3 py-1">Menu</div>
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            );
          })}
        </aside>

        {/* Dynamic Screen Content */}
        <main className="flex-1 p-3 sm:p-6 overflow-x-hidden">{children}</main>
      </div>

      {/* Mobile Sticky Bottom Navigation (<768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around py-2 px-1">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            pathname === "/" ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>Home</span>
        </Link>

        <Link
          href="/seva"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            pathname.startsWith("/seva") ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"
          }`}
        >
          <ClipboardList className="w-5 h-5" />
          <span>Seva</span>
        </Link>

        <Link
          href="/my-seva"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            pathname.startsWith("/my-seva") ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span>My Seva</span>
        </Link>

        <Link
          href="/files"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            pathname.startsWith("/files") ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"
          }`}
        >
          <FolderTree className="w-5 h-5" />
          <span>Files</span>
        </Link>

        <Link
          href="/reports"
          className={`flex flex-col items-center gap-0.5 text-[10px] font-medium ${
            pathname.startsWith("/reports") ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-500"
          }`}
        >
          <FileBarChart2 className="w-5 h-5" />
          <span>Reports</span>
        </Link>
      </nav>
    </div>
  );
}
