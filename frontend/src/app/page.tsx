
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";

type AuthStatus = {
  authenticated: boolean;
  customer: { id: number } | null;
};

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function redirectCustomer() {
      try {
        const result = await apiRequest<AuthStatus>("/auth/me", {
          method: "GET",
          cache: "no-store",
        });

        if (cancelled) return;

        router.replace(
          result.authenticated && result.customer
            ? "/dashboard"
            : "/login",
        );
      } catch {
        if (!cancelled) {
          router.replace("/login");
        }
      }
    }

    void redirectCustomer();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#080d19] text-slate-300">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-400/20 border-t-blue-400" />
        <p className="mt-4 text-sm">Opening your workspace...</p>
      </div>
    </main>
  );
}
