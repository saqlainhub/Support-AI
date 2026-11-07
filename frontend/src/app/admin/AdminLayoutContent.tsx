"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { apiRequest } from "@/lib/api";

interface AdminUser {
  id: number;
  username: string;
  is_active: boolean;
  created_at: string;
}

type AuthState = "checking" | "authenticated" | "unauthenticated" | "error";

export default function AdminLayoutContent({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const isLoginPage = pathname === "/admin/login";

  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    let cancelled = false;

    async function checkAdminSession() {
      if (isLoginPage) {
        setAuthState("unauthenticated");
        return;
      }

      setAuthState("checking");

      try {
        // The backend returns the AdminUser object directly.
        const admin = await apiRequest<AdminUser>("/admin/auth/me");

        if (cancelled) return;

        if (admin?.id && admin.is_active) {
        setAuthState("authenticated");
      } else {
        setAuthState("unauthenticated");
        router.replace("/admin/login");
      }
      } catch (error) {
        if (cancelled) return;

        console.error("Admin session verification failed:", error);

        setAuthState("error");
      }
    }

    void checkAdminSession();

    return () => {
      cancelled = true;
    };
  }, [isLoginPage, pathname, router]);

  // Keep the login page accessible without authentication.
  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authState === "checking" || authState === "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111F] text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#E6A000]" />
          <p className="mt-4 text-sm text-slate-400">
            Verifying administrator session...
          </p>
        </div>
      </main>
    );
  }

  if (authState === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111F] px-4 text-white">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">
            Unable to verify your session
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Check the browser console for the underlying error.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-[#E6A000] px-5 py-2.5 font-semibold text-[#07111F]"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  return (
    <DashboardShell
      role="admin"
      title="Admin Console"
      description="Customer support system management"
    >
      {children}
    </DashboardShell>
  );
}