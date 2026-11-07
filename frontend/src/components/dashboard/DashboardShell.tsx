
"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "./Sidebar";

type Props = {
  role: "admin" | "customer";
  title: string;
  description: string;
  children: ReactNode;
};

export default function DashboardShell({
  role,
  title,
  description,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const pathname = usePathname();

  // Keep the customer chat layout full-screen.
  const isCustomerChat =
    role === "customer" && pathname === "/dashboard/conversations";

  const sidebarWidth = sidebarCollapsed ? "lg:pl-[76px]" : "lg:pl-70";

  return (
    <div className="min-h-screen bg-[#080d19] text-slate-100">
      <Sidebar
        role={role}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />

      <div
        className={`min-h-screen transition-[padding] duration-200 ${sidebarWidth}`}
      >
        {!isCustomerChat && (
          <header className="md:flex lg:hidden sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-white/[0.07] bg-[#080d19]/90 px-4 backdrop-blur-xl sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open navigation"
                className="rounded-lg border border-white/10 p-2 text-slate-300 transition hover:bg-white/5 lg:hidden"
              >
                <Menu size={20} />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold sm:text-base">
                  {title}
                </h1>
                <p className="hidden text-xs text-slate-500 sm:block">
                  {description}
                </p>
              </div>
            </div>

            {role === "admin" && (
              <span className="hidden rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1.5 text-[11px] font-medium text-blue-300 sm:inline-flex">
                ADMIN WORKSPACE
              </span>
            )}
          </header>
        )}

        {isCustomerChat && (
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open navigation"
            title="Open navigation"
            className="fixed left-3 top-3 z-30 rounded-xl border border-white/10 bg-[#0b1120]/95 p-2.5 text-slate-300 shadow-lg backdrop-blur lg:hidden"
          >
            <Menu size={19} />
          </button>
        )}

        <main
          className={
            isCustomerChat
              ? "min-h-screen"
              : "mx-auto max-w-[1500px] p-4 sm:p-7 lg:p-9"
          }
        >
          {children}
        </main>
      </div>
    </div>
  );
}
