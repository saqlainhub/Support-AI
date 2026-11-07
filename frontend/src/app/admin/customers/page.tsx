
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  UserRound,
  CalendarDays,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type Customer = {
  id: number | string;
  name: string | null;
  email: string | null;
  created_at: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString();
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<Customer[]>("/customers");
      setCustomers(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load customers."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCustomers();
  }, [loadCustomers]);

  const filteredCustomers = customers.filter((customer) => {
    const query = search.trim().toLowerCase();

    return (
      String(customer.id).toLowerCase().includes(query) ||
      (customer.name ?? "").toLowerCase().includes(query) ||
      (customer.email ?? "").toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-blue-400">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Customers
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            View and search customer records stored in your database.
          </p>
        </div>

        <button
          onClick={() => void loadCustomers()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Total customers</p>
            <Users size={20} className="text-blue-400" />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">
            {loading ? "—" : customers.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Records returned by the backend
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Search results</p>
            <Search size={20} className="text-indigo-400" />
          </div>
          <p className="mt-4 text-3xl font-semibold text-white">
            {loading ? "—" : filteredCustomers.length}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Customers matching your search
          </p>
        </div>
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
        <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-medium text-white">Customer directory</h2>
            <p className="mt-1 text-sm text-slate-400">
              Customer details available in the current data model.
            </p>
          </div>

          <div className="relative w-full sm:max-w-sm">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search ID, name, or email..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>
        </div>

        {error && (
          <div className="m-5 flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-400">
            <LoaderCircle size={18} className="animate-spin" />
            Loading customers...
          </div>
        ) : !error && filteredCustomers.length === 0 ? (
          <div className="p-16 text-center">
            <Users size={30} className="mx-auto text-slate-600" />
            <p className="mt-3 text-sm text-slate-300">
              No customers found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try a different search or create a test conversation.
            </p>
          </div>
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/40 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">Email</th>
                  <th className="px-5 py-4 font-medium">Customer ID</th>
                  <th className="px-5 py-4 font-medium">Created</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-800/80">
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="transition hover:bg-slate-800/30"
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                          <UserRound size={19} />
                        </div>
                        <span className="text-sm font-medium text-white">
                          {customer.name?.trim() ||
                            `Customer #${customer.id}`}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-sm text-slate-300">
                      {customer.email || "Not available"}
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                        #{customer.id}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                        <CalendarDays size={14} />
                        {formatDate(customer.created_at)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <p className="text-xs leading-5 text-slate-500">
        This page currently supports viewing and searching only. Customer
        authentication, access controls, editing, and deletion are not
        implemented.
      </p>
    </div>
  );
}