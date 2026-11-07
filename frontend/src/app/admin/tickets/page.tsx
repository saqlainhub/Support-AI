
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
  RefreshCw,
  Search,
  Ticket as TicketIcon,
  AlertCircle,
  Clock,
  CheckCircle2,
  X,
} from "lucide-react";

type SupportTicket = {
  id: number;
  customer_id: number;
  conversation_id: number;
  subject: string;
  description: string;
  status: string;
  created_at: string;
};

type StatusFilter = "all" | "open" | "in_progress" | "closed";

export default function AdminTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [selectedTicket, setSelectedTicket] =
    useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

    const [updatingTicketId, setUpdatingTicketId] =
    useState<number | null>(null);
    const [updateError, setUpdateError] = useState("");

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<SupportTicket[]>("/tickets");
      setTickets(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load support tickets."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !query ||
        String(ticket.id).includes(query) ||
        String(ticket.customer_id).includes(query) ||
        ticket.subject.toLowerCase().includes(query) ||
        ticket.description.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" ||
        ticket.status.toLowerCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tickets, search, statusFilter]);

  const openCount = tickets.filter(
    (ticket) => ticket.status.toLowerCase() === "open"
  ).length;

  const closedCount = tickets.filter(
    (ticket) => ticket.status.toLowerCase() === "closed"
  ).length;

  function formatDate(value: string) {
    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? "Unknown date"
      : date.toLocaleString();
  }

  function statusStyle(status: string) {
    switch (status.toLowerCase()) {
      case "open":
        return "border-blue-500/30 bg-blue-500/10 text-blue-300";
      case "in_progress":
        return "border-amber-500/30 bg-amber-500/10 text-amber-300";
      case "closed":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
      default:
        return "border-white/10 bg-white/5 text-slate-300";
    }
  }


  async function updateTicketStatus(
  ticketId: number,
  status: "open" | "in_progress" | "closed"
) {
  setUpdatingTicketId(ticketId);
  setUpdateError("");

  try {
    await apiRequest<{
      message: string;
      ticket_id: number;
      status: string;
    }>(`/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });

    setTickets((current) =>
      current.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, status }
          : ticket
      )
    );

    setSelectedTicket((current) =>
      current?.id === ticketId
        ? { ...current, status }
        : current
    );
  } catch (err) {
    setUpdateError(
      err instanceof Error
        ? err.message
        : "Failed to update ticket status."
    );
  } finally {
    setUpdatingTicketId(null);
  }
}

  return (
    <div className="space-y-6 text-slate-100">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold">Support Tickets</h1>
          <p className="mt-1 text-sm text-slate-400">
            Review customer support requests and their status.
          </p>
        </div>

        <button
          onClick={() => void loadTickets()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw
            size={16}
            className={loading ? "animate-spin" : ""}
          />
          Refresh
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          label="Total tickets"
          value={tickets.length}
          icon={<TicketIcon size={19} />}
        />
        <MetricCard
          label="Open tickets"
          value={openCount}
          icon={<Clock size={19} />}
        />
        <MetricCard
          label="Closed tickets"
          value={closedCount}
          icon={<CheckCircle2 size={19} />}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tickets, customers, or descriptions..."
            className="w-full rounded-xl border border-white/10 bg-slate-900 py-3 pl-10 pr-4 text-sm outline-none focus:border-blue-500/50"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as StatusFilter)
          }
          className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none focus:border-blue-500/50"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="in_progress">In progress</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <div>
            <p>{error}</p>
            <button
              onClick={() => void loadTickets()}
              className="mt-2 underline underline-offset-4"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/50">
        <div className="border-b border-white/10 px-5 py-4">
          <h2 className="font-medium">Ticket list</h2>
          <p className="mt-1 text-xs text-slate-500">
            {filteredTickets.length} result
            {filteredTickets.length === 1 ? "" : "s"}
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Loading tickets...
          </div>
        ) : error && tickets.length === 0 ? (
          <div className="p-12 text-center text-sm text-slate-400">
            Tickets could not be loaded.
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="p-12 text-center">
            <TicketIcon
              size={30}
              className="mx-auto mb-3 text-slate-600"
            />
            <p className="text-sm text-slate-300">
              No tickets found.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Try another search or status filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-white/[0.03] text-xs text-slate-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Ticket</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    className="hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-medium">
                        #{ticket.id} · {ticket.subject}
                      </p>
                      <p className="mt-1 max-w-xs truncate text-xs text-slate-500">
                        {ticket.description}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-slate-300">
                      <p>Customer #{ticket.customer_id}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Conversation #{ticket.conversation_id}
                      </p>
                    </td>

                    <td className="px-5 py-4">
                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs ${statusStyle(ticket.status)}`}
                      >
                        {ticket.status.replaceAll("_", " ")}
                      </span>
                    </td>


                    <td className="px-5 py-4">
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
                      >
                        View details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-dialog-title"
            className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-slate-500">
                  Ticket #{selectedTicket.id}
                </p>
                <h2
                  id="ticket-dialog-title"
                  className="mt-1 text-lg font-semibold"
                >
                  {selectedTicket.subject}
                </h2>
              </div>

              <button
                onClick={() => setSelectedTicket(null)}
                aria-label="Close ticket details"
                className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-xs text-slate-500">Description</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {selectedTicket.description || "No description provided."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500">Customer ID</p>
                  <p className="mt-1 text-sm">
                    #{selectedTicket.customer_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Conversation ID</p>
                  <p className="mt-1 text-sm">
                    #{selectedTicket.conversation_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Status</p>
                  <p className="mt-1 text-sm capitalize">
                    {selectedTicket.status.replaceAll("_", " ")}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Created</p>
                  <p className="mt-1 text-sm">
                    {formatDate(selectedTicket.created_at)}
                  </p>
                </div>
              </div>
            </div>


            
<div className="mt-5 border-t border-white/10 pt-4">
  <label
    htmlFor="ticket-status"
    className="block text-sm font-medium text-slate-300"
  >
    Update ticket status
  </label>

  <select
    id="ticket-status"
    value={selectedTicket.status}
    disabled={updatingTicketId === selectedTicket.id}
    onChange={(event) => {
      const status = event.target.value as
        | "open"
        | "in_progress"
        | "closed";

      void updateTicketStatus(selectedTicket.id, status);
    }}
    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm disabled:opacity-50"
  >
    <option value="open">Open</option>
    <option value="in_progress">In progress</option>
    <option value="closed">Closed</option>
  </select>

  {updatingTicketId === selectedTicket.id && (
    <p className="mt-2 text-xs text-slate-400">
      Updating status...
    </p>
  )}

  {updateError && (
    <p className="mt-2 text-sm text-red-400">
      {updateError}
    </p>
  )}
</div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedTicket(null)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-5">
      <div className="flex items-center justify-between text-slate-400">
        <p className="text-sm">{label}</p>
        {icon}
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
    </div>
  );
}