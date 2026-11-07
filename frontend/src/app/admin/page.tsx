"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import {
Activity,
ArrowUpRight,
Files,
LifeBuoy,
MessageSquare,
Users,
ChartNoAxesCombined,
RefreshCw,
AlertCircle,
Clock3,
} from "lucide-react";

const sections = [
{
label: "Knowledge Base",
description: "Manage business documents and the AI's reference material.",
href: "/admin/documents",
icon: Files,
},
{
label: "Customers",
description: "Inspect customer accounts and account activity.",
href: "/admin/customers",
icon: Users,
},
{
label: "Conversations",
description: "Review customer messages and AI responses.",
href: "/admin/conversations",
icon: MessageSquare,
},
{
label: "Support Tickets",
description: "Review support requests and their status.",
href: "/admin/tickets",
icon: LifeBuoy,
},
{
label: "AI Usage & Tokens",
description: "Track model requests, token usage, errors and cost.",
href: "/admin/usage",
icon: ChartNoAxesCombined,
},
{
label: "System Activity",
description: "Review operational events and system health.",
href: "/admin/activity",
icon: Activity,
},
];

type AdminStats = {
customers: number;
conversations: number;
tickets: number;
open_tickets: number;
documents: number;
};

type AIUsage = {
summary: {
total_interactions: number;
input_tokens: number;
output_tokens: number;
total_tokens: number;
};
by_operation: {
operation: string;
interactions: number;
input_tokens: number;
output_tokens: number;
total_tokens: number;
}[];
recent_records: {
id: number;
conversation_id: number | null;
interaction_id: string | null;
model: string;
operation: string;
input_tokens: number;
output_tokens: number;
total_tokens: number;
created_at: string;
}[];
};

type SystemActivity = {
id: number;
event_type: string;
description: string;
entity_type: string | null;
entity_id: number | null;
created_at: string;
};

function formatNumber(value: number | undefined) {
return value === undefined ? "—" : value.toLocaleString();
}

function formatEventType(value: string) {
return value
.split("_")
.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
.join(" ");
}

function formatDate(value: string) {
const date = new Date(value);

if (Number.isNaN(date.getTime())) return value;

return date.toLocaleString(undefined, {
month: "short",
day: "numeric",
year: "numeric",
hour: "numeric",
minute: "2-digit",
});
}

function eventStyle(eventType: string) {
if (eventType.includes("deleted")) {
return "border-red-400/20 bg-red-400/10 text-red-300";
}

if (eventType.includes("created")) {
return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
}

if (eventType.includes("changed")) {
return "border-amber-400/20 bg-amber-400/10 text-amber-300";
}

if (eventType.includes("uploaded")) {
return "border-blue-400/20 bg-blue-400/10 text-blue-300";
}

return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}

export default function AdminDashboard() {
const [stats, setStats] = useState<AdminStats | null>(null);
const [usage, setUsage] = useState<AIUsage | null>(null);
const [activities, setActivities] = useState<SystemActivity[]>([]);

const [statsError, setStatsError] = useState("");
const [usageError, setUsageError] = useState("");
const [activityError, setActivityError] = useState("");

const [loading, setLoading] = useState(true);
const [activityLoading, setActivityLoading] = useState(true);

const fetchActivities = useCallback(async () => {
setActivityLoading(true);
setActivityError("");


try {
  const data = await apiRequest<SystemActivity[]>("/admin/activity");
  setActivities(data.slice(0, 5));
} catch (err) {
  setActivityError(
    err instanceof Error
      ? err.message
      : "Could not load recent system activity.",
  );
} finally {
  setActivityLoading(false);
}


}, []);

useEffect(() => {
let active = true;


async function loadDashboard() {
  setLoading(true);
  setStatsError("");
  setUsageError("");

  const [statsResult, usageResult] = await Promise.allSettled([
    apiRequest<AdminStats>("/admin/stats"),
    apiRequest<AIUsage>("/admin/usage"),
  ]);

  if (!active) return;

  if (statsResult.status === "fulfilled") {
    setStats(statsResult.value);
  } else {
    setStatsError(
      statsResult.reason instanceof Error
        ? statsResult.reason.message
        : "Could not load dashboard metrics.",
    );
  }

  if (usageResult.status === "fulfilled") {
    setUsage(usageResult.value);
  } else {
    setUsageError(
      usageResult.reason instanceof Error
        ? usageResult.reason.message
        : "Could not load AI usage.",
    );
  }

  setLoading(false);
}

void loadDashboard();

return () => {
  active = false;
};


}, []);

useEffect(() => {
void fetchActivities();
}, [fetchActivities]);

const metrics = [
{
label: "Total customers",
value: stats?.customers,
note: "Customer records in the database",
icon: Users,
},
{
label: "Conversations",
value: stats?.conversations,
note: "Total recorded conversations",
icon: MessageSquare,
},
{
label: "Knowledge documents",
value: stats?.documents,
note: "Documents in the knowledge base",
icon: Files,
},
{
label: "Total tickets",
value: stats?.tickets,
note: `${stats?.open_tickets ?? "—"} currently open`,
icon: LifeBuoy,
},
{
label: "Open tickets",
value: stats?.open_tickets,
note: "Tickets awaiting resolution",
icon: AlertCircle,
},
{
label: "AI tokens used",
value: usage?.summary.total_tokens,
note: usage
? `${formatNumber(usage.summary.total_interactions)} recorded AI interactions`
: usageError
? "AI usage unavailable"
: "Total recorded input and output tokens",
icon: ChartNoAxesCombined,
},
];

return ( <div className="space-y-8"> <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"> <div> <p className="text-sm font-medium text-blue-400">
WORKSPACE OVERVIEW </p>


      <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
        System management
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Manage the knowledge base, customer conversations, support tickets,
        and AI usage from one place.
      </p>
    </div>

    <span className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
      <span
        className={`h-2 w-2 rounded-full ${
          stats && !statsError ? "bg-emerald-400" : "bg-amber-400"
        }`}
      />
      {loading
        ? "Loading metrics..."
        : statsError
          ? "Metrics unavailable"
          : "Database metrics connected"}
    </span>
  </section>

  {statsError && (
    <div className="flex flex-col gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3 text-sm text-red-300">
        <AlertCircle size={18} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-medium">Unable to load dashboard metrics</p>
          <p className="mt-1 break-words text-red-300/80">{statsError}</p>
        </div>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs hover:bg-white/5"
      >
        <RefreshCw size={14} />
        Retry
      </button>
    </div>
  )}

  {usageError && (
    <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-300">
      <AlertCircle size={18} className="mt-0.5 shrink-0" />
      <div>
        <p className="font-medium">AI usage data unavailable</p>
        <p className="mt-1 break-words text-amber-300/80">{usageError}</p>
      </div>
    </div>
  )}

  <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    {metrics.map((metric) => {
      const Icon = metric.icon;

      const value =
        metric.value !== undefined
          ? formatNumber(metric.value)
          : loading
            ? "..."
            : "—";

      return (
        <div
          key={metric.label}
          className="rounded-2xl border border-white/[0.08] bg-[#0d1423] p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-slate-400">{metric.label}</p>

            <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <Icon size={18} />
            </div>
          </div>

          <p className="mt-5 text-3xl font-semibold tracking-tight">
            {value}
          </p>

          <p className="mt-2 text-xs text-slate-500">{metric.note}</p>
        </div>
      );
    })}
  </section>

  {/* Recent system activity */}
  <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1423]">
    <div className="flex flex-col justify-between gap-3 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-400">
          <Activity size={20} />
        </div>

        <div>
          <h3 className="font-semibold">Recent system activity</h3>
          <p className="mt-1 text-xs text-slate-500">
            Latest recorded events across your platform
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={fetchActivities}
          disabled={activityLoading}
          aria-label="Refresh recent activity"
          className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-slate-300 transition hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw
            size={14}
            className={activityLoading ? "animate-spin" : ""}
          />
          Refresh
        </button>

        <Link
          href="/admin/activity"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-500/15"
        >
          View all
          <ArrowUpRight size={14} />
        </Link>
      </div>
    </div>

    {activityError ? (
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 text-sm text-red-300">
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Unable to load recent activity</p>
            <p className="mt-1 break-words text-red-300/70">
              {activityError}
            </p>
          </div>
        </div>

        <button
          onClick={fetchActivities}
          className="w-fit text-xs text-blue-400 hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    ) : activityLoading && activities.length === 0 ? (
      <div className="space-y-4 p-5">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex animate-pulse gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.05]" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 w-1/3 rounded bg-white/[0.06]" />
              <div className="h-3 w-2/3 rounded bg-white/[0.04]" />
            </div>
          </div>
        ))}
      </div>
    ) : activities.length === 0 ? (
      <div className="p-10 text-center">
        <Activity size={24} className="mx-auto text-slate-600" />
        <p className="mt-3 text-sm font-medium text-slate-300">
          No activity recorded yet
        </p>
        <p className="mt-1 text-xs text-slate-500">
          System events will appear here when they occur.
        </p>
      </div>
    ) : (
      <div className="divide-y divide-white/[0.05]">
        {activities.map((item) => (
          <div
            key={item.id}
            className="flex gap-3 p-4 transition hover:bg-white/[0.02] sm:gap-4 sm:px-5"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-blue-400">
              <Activity size={17} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span
                  className={`inline-flex w-fit rounded-md border px-2 py-1 text-[11px] font-medium ${eventStyle(item.event_type)}`}
                >
                  {formatEventType(item.event_type)}
                </span>

                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <Clock3 size={12} />
                  {formatDate(item.created_at)}
                </span>
              </div>

              <p className="mt-2 break-words text-sm leading-6 text-slate-300">
                {item.description}
              </p>

              {item.entity_type && (
                <p className="mt-1 text-xs text-slate-500">
                  {formatEventType(item.entity_type)}
                  {item.entity_id !== null && ` #${item.entity_id}`}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    )}

    {!activityError && activities.length > 0 && (
      <div className="border-t border-white/[0.07] px-5 py-3">
        <Link
          href="/admin/activity"
          className="text-xs font-medium text-blue-400 transition hover:text-blue-300"
        >
          Open complete activity log
          <span className="ml-1">→</span>
        </Link>
      </div>
    )}
  </section>

  <section>
    <div className="mb-4">
      <h3 className="text-base font-semibold">Management tools</h3>
      <p className="mt-1 text-sm text-slate-500">
        Open a workspace to manage that part of the system.
      </p>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {sections.map((section) => {
        const Icon = section.icon;

        return (
          <Link
            key={section.label}
            href={section.href}
            className="group rounded-2xl border border-white/[0.08] bg-[#0d1423] p-5 transition hover:border-blue-500/30 hover:bg-[#101a2c]"
          >
            <div className="flex items-start justify-between">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <Icon size={21} />
              </div>

              <ArrowUpRight
                size={18}
                className="text-slate-600 transition group-hover:text-blue-400"
              />
            </div>

            <h4 className="mt-5 font-semibold">{section.label}</h4>

            <p className="mt-2 min-h-12 text-sm leading-6 text-slate-400">
              {section.description}
            </p>
          </Link>
        );
      })}
    </div>
  </section>
</div>


);
}
