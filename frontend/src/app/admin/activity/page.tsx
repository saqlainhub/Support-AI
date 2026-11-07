"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Activity = {
id: number;
event_type: string;
description: string;
entity_type: string | null;
entity_id: number | null;
created_at: string;
};

export default function ActivityPage() {
const [activities, setActivities] = useState<Activity[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [filter, setFilter] = useState("all");

const fetchActivities = useCallback(async () => {
setLoading(true);
setError("");


try {
  const data = await apiRequest<Activity[]>("/admin/activity");
  setActivities(data);
} catch (err) {
  setError(
    err instanceof Error
      ? err.message
      : "Failed to load system activity.",
  );
} finally {
  setLoading(false);
}


}, []);

useEffect(() => {
void fetchActivities();
}, [fetchActivities]);

const eventTypes = [
...new Set(activities.map((activity) => activity.event_type)),
];

const filteredActivities =
filter === "all"
? activities
: activities.filter((activity) => activity.event_type === filter);

const formatEvent = (value: string) =>
value
.split("_")
.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
.join(" ");

const formatDate = (value: string) => {
const date = new Date(value);
return Number.isNaN(date.getTime())
? value
: date.toLocaleString();
};

const eventStyle = (type: string) => {
if (type.includes("deleted"))
return "border-red-400/20 bg-red-400/10 text-red-300";
if (type.includes("created"))
return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
if (type.includes("changed"))
return "border-amber-400/20 bg-amber-400/10 text-amber-300";
if (type.includes("uploaded"))
return "border-blue-400/20 bg-blue-400/10 text-blue-300";


return "border-slate-400/20 bg-slate-400/10 text-slate-300";


};

const cardClass =
"rounded-xl border border-white/[0.08] bg-[#0d1424]";

return ( <div className="space-y-7"> <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"> <div> <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-blue-400"> <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
Administration </div> <h1 className="text-2xl font-semibold tracking-tight text-slate-100">
System Activity </h1> <p className="mt-2 text-sm text-slate-400">
Monitor important events across your support platform. </p> </div>


    <button
      onClick={fetchActivities}
      disabled={loading}
      className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
    >
      {loading ? "Refreshing..." : "↻ Refresh"}
    </button>
  </header>

  <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
    {[
      {
        label: "Total Events Loaded",
        value: activities.length,
        accent: "text-blue-400",
      },
      {
        label: "Event Categories",
        value: eventTypes.length,
        accent: "text-violet-400",
      },
      {
        label: "Filtered Events",
        value: filteredActivities.length,
        accent: "text-emerald-400",
      },
    ].map((item) => (
      <div key={item.label} className={`${cardClass} p-5`}>
        <p className="text-sm text-slate-400">{item.label}</p>
        <p className={`mt-3 text-3xl font-semibold ${item.accent}`}>
          {item.value}
        </p>
      </div>
    ))}
  </section>

  <section className={`${cardClass} overflow-hidden`}>
    <div className="flex flex-col justify-between gap-4 border-b border-white/[0.07] p-5 sm:flex-row sm:items-center">
      <div>
        <h2 className="font-semibold text-slate-100">
          Recent Events
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Latest activity recorded by the backend
        </p>
      </div>

      <select
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        className="rounded-lg border border-white/10 bg-[#080d19] px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500"
      >
        <option value="all">All event types</option>
        {eventTypes.map((type) => (
          <option key={type} value={type}>
            {formatEvent(type)}
          </option>
        ))}
      </select>
    </div>

    {error && (
      <div className="m-5 rounded-lg border border-red-400/20 bg-red-400/[0.07] p-4 text-sm text-red-300">
        <p className="font-medium">Unable to load activity</p>
        <p className="mt-1 break-words text-red-200/70">{error}</p>
        <button
          onClick={fetchActivities}
          className="mt-3 underline underline-offset-4"
        >
          Try again
        </button>
      </div>
    )}

    {loading && activities.length === 0 ? (
      <div className="p-12 text-center text-sm text-slate-400">
        Loading activity...
      </div>
    ) : !error && filteredActivities.length === 0 ? (
      <div className="p-12 text-center">
        <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-xl text-slate-400">
          ↗
        </div>
        <p className="font-medium text-slate-200">
          No activity found
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Recorded system events will appear here.
        </p>
      </div>
    ) : (
      filteredActivities.length > 0 && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-white/[0.07] bg-white/[0.02]">
                <tr className="text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-4 font-medium">Event</th>
                  <th className="px-5 py-4 font-medium">Description</th>
                  <th className="px-5 py-4 font-medium">Entity</th>
                  <th className="px-5 py-4 font-medium">Timestamp</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/[0.05]">
                {filteredActivities.map((activity) => (
                  <tr
                    key={activity.id}
                    className="transition hover:bg-white/[0.025]"
                  >
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex whitespace-nowrap rounded-md border px-2.5 py-1 text-xs font-medium ${eventStyle(activity.event_type)}`}
                      >
                        {formatEvent(activity.event_type)}
                      </span>
                    </td>

                    <td className="max-w-sm px-5 py-4 leading-6 text-slate-300">
                      {activity.description}
                    </td>

                    <td className="px-5 py-4 text-slate-400">
                      {activity.entity_type ? (
                        <span>
                          {formatEvent(activity.entity_type)}
                          {activity.entity_id !== null &&
                            ` #${activity.entity_id}`}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">
                      {formatDate(activity.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="border-t border-white/[0.07] px-5 py-3 text-xs text-slate-500">
            Showing {filteredActivities.length} events · Backend limit: 100
          </footer>
        </>
      )
    )}
  </section>
</div>


);
}
