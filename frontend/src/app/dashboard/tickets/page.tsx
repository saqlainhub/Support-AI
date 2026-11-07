
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  FileText,
  LifeBuoy,
  LoaderCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type Conversation = {
  id: number;
  customer_id: number;
  title: string | null;
  created_at: string;
};

type SupportTicket = {
  id: number;
  customer_id: number;
  conversation_id: number;
  subject: string;
  description: string;
  status: "open" | "in_progress" | "closed";
  created_at: string;
};

type TicketCreatedResponse = {
  message: string;
  ticket_id: number;
  status: SupportTicket["status"];
};

const statusConfig = {
  open: {
    label: "Open",
    className: "border-sky-400/20 bg-sky-400/10 text-sky-300",
    dotClassName: "bg-sky-400",
  },
  in_progress: {
    label: "In Progress",
    className:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
    dotClassName: "bg-amber-400",
  },
  closed: {
    label: "Closed",
    className:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-300",
    dotClassName: "bg-emerald-400",
  },
} as const;

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  try {
    const parsed = JSON.parse(error.message);
    return parsed.detail || parsed.message || error.message;
  } catch {
    return error.message;
  }
}

function StatusBadge({ status }: { status: SupportTicket["status"] }) {
  const config = statusConfig[status] ?? statusConfig.open;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${config.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${config.dotClassName}`} />
      {config.label}
    </span>
  );
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [conversationId, setConversationId] = useState("");


const loadData = useCallback(async (isRefresh = false) => {
  if (isRefresh) {
    setRefreshing(true);
  } else {
    setLoading(true);
  }

  setError("");

  try {
    const [ticketData, conversationData] = await Promise.all([
      apiRequest<SupportTicket[]>("/customer/tickets"),
      apiRequest<Conversation[]>("/customer/conversations"),
    ]);

    setTickets(ticketData);
    setConversations(conversationData);
  } catch (err) {
    setError(getErrorMessage(err));
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, []);


  useEffect(() => {
    void loadData();
  }, [loadData]);

  const conversationMap = useMemo(
    () => new Map(conversations.map((conversation) => [
      conversation.id,
      conversation,
    ])),
    [conversations]
  );

  const filteredTickets = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      const matchesSearch =
        !normalizedSearch ||
        ticket.subject.toLowerCase().includes(normalizedSearch) ||
        ticket.description.toLowerCase().includes(normalizedSearch) ||
        String(ticket.id).includes(normalizedSearch);

      return matchesStatus && matchesSearch;
    });
  }, [tickets, search, statusFilter]);

  const openCount = tickets.filter(
    (ticket) => ticket.status === "open"
  ).length;

  const inProgressCount = tickets.filter(
    (ticket) => ticket.status === "in_progress"
  ).length;

  const closedCount = tickets.filter(
    (ticket) => ticket.status === "closed"
  ).length;

  function resetForm() {
    setSubject("");
    setDescription("");
    setConversationId("");
    setFormError("");
  }


async function handleCreateTicket(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  setFormError("");
  setSuccessMessage("");

  const normalizedSubject = subject.trim();
  const normalizedDescription = description.trim();

  if (!normalizedSubject) {
    setFormError("Enter a subject for your ticket.");
    return;
  }

  if (!conversationId) {
    setFormError("Select the conversation related to this issue.");
    return;
  }

  if (!normalizedDescription) {
    setFormError("Describe the issue before submitting.");
    return;
  }

  const selectedConversation = conversationMap.get(Number(conversationId));

  if (!selectedConversation) {
    setFormError("The selected conversation could not be found.");
    return;
  }

  setSubmitting(true);

  try {
    const result = await apiRequest<TicketCreatedResponse>("/tickets", {
      method: "POST",
      body: JSON.stringify({
        conversation_id: selectedConversation.id,
        subject: normalizedSubject,
        description: normalizedDescription,
      }),
    });

    setSuccessMessage(`Ticket #${result.ticket_id} was created successfully.`);
    resetForm();
    setShowCreateForm(false);
    await loadData(true);
  } catch (err) {
    setFormError(getErrorMessage(err));
  } finally {
    setSubmitting(false);
  }
}


  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-12">
      {/* Page heading */}
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
            <LifeBuoy size={24} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Support tickets
              </h1>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                My support
              </span>
            </div>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              Track your reported issues, review ticket statuses, and contact
              support about an existing conversation.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => {
              setSuccessMessage("");
              setFormError("");
              setShowCreateForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
          >
            <Plus size={17} />
            New ticket
          </button>
        </div>
      </section>

      {/* Feedback */}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] p-4 text-sm text-rose-200">
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Could not load support tickets</p>
            <p className="mt-1 break-words text-rose-200/75">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-semibold hover:bg-rose-400/10"
          >
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-200">
          <CheckCircle2 size={19} className="shrink-0" />
          <p className="flex-1">{successMessage}</p>
          <button
            type="button"
            aria-label="Dismiss success message"
            onClick={() => setSuccessMessage("")}
            className="rounded-lg p-1 hover:bg-emerald-400/10"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Ticket statistics */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1322] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Open tickets</p>
            <div className="rounded-xl bg-sky-400/10 p-2.5 text-sky-300">
              <Ticket size={19} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-semibold tracking-tight text-white">
              {loading ? "—" : openCount}
            </p>
            <span className="text-xs text-slate-500">Awaiting resolution</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1322] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">In progress</p>
            <div className="rounded-xl bg-amber-400/10 p-2.5 text-amber-300">
              <Clock3 size={19} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-semibold tracking-tight text-white">
              {loading ? "—" : inProgressCount}
            </p>
            <span className="text-xs text-slate-500">Being reviewed</span>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.07] bg-[#0c1322] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-400">Resolved / closed</p>
            <div className="rounded-xl bg-emerald-400/10 p-2.5 text-emerald-300">
              <ShieldCheck size={19} />
            </div>
          </div>
          <div className="mt-4 flex items-end justify-between">
            <p className="text-3xl font-semibold tracking-tight text-white">
              {loading ? "—" : closedCount}
            </p>
            <span className="text-xs text-slate-500">Closed tickets</span>
          </div>
        </div>
      </section>

      {/* Main ticket list */}
      <section className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0c1322]">
        <div className="flex flex-col gap-4 border-b border-white/[0.07] p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">Your tickets</h2>
            <p className="mt-1 text-sm text-slate-500">
              {loading
                ? "Loading your support history..."
                : `${filteredTickets.length} of ${tickets.length} ticket${tickets.length === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 sm:w-64">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets..."
                aria-label="Search tickets"
                className="w-full rounded-xl border border-white/10 bg-[#080e1a] py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/10"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter tickets by status"
              className="rounded-xl border border-white/10 bg-[#080e1a] px-3 py-2.5 text-sm text-slate-300 outline-none focus:border-blue-400/50"
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8">
            <LoaderCircle size={26} className="animate-spin text-blue-400" />
            <p className="text-sm text-slate-500">Loading your tickets...</p>
          </div>
        ) : error ? (
          <div className="flex min-h-52 flex-col items-center justify-center px-6 py-12 text-center">
            <AlertCircle size={28} className="text-rose-300" />
            <p className="mt-3 font-medium text-white">Tickets are unavailable</p>
            <p className="mt-1 max-w-md text-sm text-slate-500">
              Resolve the loading error above and retry to view your tickets.
            </p>
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-slate-400">
              {search || statusFilter !== "all" ? (
                <Search size={25} />
              ) : (
                <MessageSquare size={25} />
              )}
            </div>
            <h3 className="mt-5 text-base font-semibold text-white">
              {search || statusFilter !== "all"
                ? "No matching tickets"
                : "No support tickets yet"}
            </h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
              {search || statusFilter !== "all"
                ? "Try changing your search or status filter."
                : "If you need help with an issue, create a ticket and link it to one of your conversations."}
            </p>
            {search || statusFilter !== "all" ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                }}
                className="mt-4 text-sm font-medium text-blue-300 hover:text-blue-200"
              >
                Clear filters
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                <Plus size={16} />
                Create your first ticket
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {filteredTickets.map((ticket) => {
              const conversation = conversationMap.get(ticket.conversation_id);

              return (
                <article
                  key={ticket.id}
                  className="p-5 transition hover:bg-white/[0.015] sm:p-6"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium text-blue-300">
                          TKT-{ticket.id}
                        </span>
                        <StatusBadge status={ticket.status} />
                      </div>

                      <h3 className="mt-3 break-words text-base font-semibold text-white">
                        {ticket.subject}
                      </h3>

                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-400">
                        {ticket.description}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Clock3 size={13} />
                          {formatDate(ticket.created_at)}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <MessageSquare size={13} />
                          Conversation #{ticket.conversation_id}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      {conversation ? (
                        <Link
                          href={`/dashboard/conversations?conversation=${conversation.id}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-blue-400/30 hover:bg-blue-500/10 hover:text-blue-200"
                        >
                          <FileText size={14} />
                          View conversation
                          <ArrowRight size={13} />
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-600">
                          Conversation unavailable
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {!loading && !error && tickets.length > 0 && (
          <div className="border-t border-white/[0.07] px-5 py-4 sm:px-6">
            <p className="text-xs text-slate-500">
              Ticket statuses are updated by the support team.
            </p>
          </div>
        )}
      </section>

      {/* Create ticket modal */}
      {showCreateForm && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !submitting) {
              setShowCreateForm(false);
              resetForm();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-ticket-title"
            className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0c1322] shadow-2xl shadow-black/40 sm:rounded-3xl"
          >
            <div className="flex items-start justify-between border-b border-white/[0.07] p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-blue-400/20 bg-blue-500/10 p-2.5 text-blue-300">
                  <Ticket size={21} />
                </div>
                <div>
                  <h2
                    id="create-ticket-title"
                    className="text-lg font-semibold text-white"
                  >
                    Create support ticket
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Describe the issue and select its related conversation.
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setShowCreateForm(false);
                  resetForm();
                }}
                aria-label="Close ticket form"
                className="rounded-xl p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-5 p-5 sm:p-6">
              {formError && (
                <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3.5 text-sm text-rose-200">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <p className="break-words">{formError}</p>
                </div>
              )}

              <div>
                <label
                  htmlFor="ticket-subject"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Subject <span className="text-rose-300">*</span>
                </label>
                <input
                  id="ticket-subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  maxLength={255}
                  required
                  placeholder="Briefly describe your issue"
                  className="w-full rounded-xl border border-white/10 bg-[#080e1a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/10"
                />
                <p className="mt-1.5 text-right text-xs text-slate-600">
                  {subject.length}/255
                </p>
              </div>

              <div>
                <label
                  htmlFor="ticket-conversation"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Related conversation <span className="text-rose-300">*</span>
                </label>
                <select
                  id="ticket-conversation"
                  value={conversationId}
                  onChange={(event) => setConversationId(event.target.value)}
                  required
                  className="w-full rounded-xl border border-white/10 bg-[#080e1a] px-4 py-3 text-sm text-slate-200 outline-none focus:border-blue-400/50"
                >
                  <option value="">Select a conversation</option>
                  {conversations.map((conversation) => (
                    <option key={conversation.id} value={conversation.id}>
                      #{conversation.id} —{" "}
                      {conversation.title?.trim() || "New conversation"}
                    </option>
                  ))}
                </select>
                {conversations.length === 0 && !loading && (
                  <p className="mt-2 text-xs leading-5 text-amber-300/80">
                    You do not have any conversations yet. Start a conversation
                    before submitting a support ticket.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="ticket-description"
                  className="mb-2 block text-sm font-medium text-slate-200"
                >
                  Description <span className="text-rose-300">*</span>
                </label>
                <textarea
                  id="ticket-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  required
                  rows={5}
                  maxLength={5000}
                  placeholder="Explain what happened, what you expected, and any steps you already tried..."
                  className="w-full resize-y rounded-xl border border-white/10 bg-[#080e1a] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-blue-400/50 focus:ring-2 focus:ring-blue-500/10"
                />
                <p className="mt-1.5 text-right text-xs text-slate-600">
                  {description.length}/5000
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/[0.07] pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setShowCreateForm(false);
                    resetForm();
                  }}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting || conversations.length === 0}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle size={16} className="animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      Submit ticket
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
