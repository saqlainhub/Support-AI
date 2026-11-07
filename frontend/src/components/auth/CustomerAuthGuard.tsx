
"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type AuthStatus = {
  authenticated: boolean;
  customer: {
    id: number;
    name: string | null;
    email: string;
    photo_url: string | null;
    email_verified: boolean;
    role: "customer";
  } | null;
};

export default function CustomerAuthGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const result = await apiRequest<AuthStatus>("/auth/me", {
          method: "GET",
          cache: "no-store",
        });

        if (cancelled) return;

        if (result.authenticated && result.customer) {
          setAuthorized(true);
        } else {
          router.replace("/login");
        }
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      }
    }

    void checkSession();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080d19] text-slate-300">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400" />
          <p className="mt-4 text-sm">Checking your session...</p>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
