import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { validateSession, SESSION_COOKIE_NAME } from "@/core/auth/session";
import { AppShell } from "./AppShell";

export const runtime = "nodejs";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const authResult = await validateSession(token);
  if (!authResult) {
    redirect("/login");
  }

  const user = {
    ...authResult.user,
    permissions: authResult.user.permissions,
  };

  return <AppShell user={user}>{children}</AppShell>;
}
