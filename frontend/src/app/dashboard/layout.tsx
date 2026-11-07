
import type { ReactNode } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import CustomerAuthGuard from "@/components/auth/CustomerAuthGuard";

export default function CustomerLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CustomerAuthGuard>
      <DashboardShell
        role="customer"
        title="Customer Portal"
        description="Your support workspace"
      >
        {children}
      </DashboardShell>
    </CustomerAuthGuard>
  );
}
