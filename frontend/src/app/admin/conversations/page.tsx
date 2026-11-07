
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Search,
  RefreshCw,
  UserRound,
  Clock3,
  LoaderCircle,
  AlertCircle,
  MessagesSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type Conversation = {
  id: number | string;
  customer_id: number | string;
  created_at: string;
};

type Message = {
  id: number | string;
  role: string;
  content: string;
  created_at: string;
};

type ConversationDetail = {
  conversation_id: number | string;
  messages: Message[];
};

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : date.toLocaleString();
}

export default function AdminConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const data = await apiRequest<Conversation[]>("/conversations");
      setConversations(data);

      setSelectedId((current) => {
        if (
          current !== null &&
          data.some((item) => String(item.id) === current)
        ) {
          return current;
        }

        return data.length ? String(data[0].id) : null;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load conversations."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    async function loadDetail() {
      setDetailLoading(true);
      setDetail(null);
      setError("");

      try {
        const data = await apiRequest<ConversationDetail>(
          `/conversations/${selectedId}`
        );

        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not load message history."
          );
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const filtered = conversations.filter((conversation) => {
    const query = search.trim().toLowerCase();

    return (
      String(conversation.id).toLowerCase().includes(query) ||
      String(conversation.customer_id).toLowerCase().includes(query)
    );
  });

  const selectedConversation = conversations.find(
    (conversation) => String(conversation.id) === selectedId
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-blue-400">Administration</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">
            Conversations
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Review saved customer conversations and their message history.
          </p>
        </div>

        <button
          onClick={() => void loadConversations()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-200 transition hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <p className="break-words">{error}</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Conversation list */}
        <section className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          <div className="border-b border-slate-800 p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-white">All conversations</h2>
              <span className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300">
                {conversations.length}
              </span>
            </div>

            <div className="relative mt-4">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search conversation or customer ID"
                className="w-full rounded-xl border border-slate-700 bg-slate-950 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="max-h-[650px] overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
                <LoaderCircle size={18} className="animate-spin" />
                Loading conversations...
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <MessagesSquare
                  size={28}
                  className="mx-auto text-slate-600"
                />
                <p className="mt-3 text-sm text-slate-300">
                  No conversations found
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Try another search or check back after a conversation is created.
                </p>
              </div>
            ) : (
              filtered.map((conversation) => {
                const active = String(conversation.id) === selectedId;

                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedId(String(conversation.id))}
                    className={`mb-1 w-full rounded-xl border p-3 text-left transition ${
                      active
                        ? "border-blue-500/40 bg-blue-500/10"
                        : "border-transparent hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`rounded-xl p-2 ${
                          active
                            ? "bg-blue-500/15 text-blue-400"
                            : "bg-slate-800 text-slate-400"
                        }`}
                      >
                        <MessageSquare size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-white">
                          Conversation #{conversation.id}
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          Customer #{conversation.customer_id}
                        </p>
                        <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                          <Clock3 size={12} />
                          {formatDate(conversation.created_at)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        {/* Message history */}
        <section className="flex min-h-[450px] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70">
          {selectedConversation ? (
            <>
              <div className="border-b border-slate-800 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-blue-500/10 p-3 text-blue-400">
                    <MessagesSquare size={21} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-semibold text-white">
                      Conversation #{selectedConversation.id}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      Customer #{selectedConversation.customer_id}
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                      Created {formatDate(selectedConversation.created_at)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                {detailLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
                    <LoaderCircle size={18} className="animate-spin" />
                    Loading message history...
                  </div>
                ) : detail && detail.messages.length > 0 ? (
                  detail.messages.map((message) => {
                    const isAssistant =
                      message.role.toLowerCase() === "assistant";

                    return (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${
                          isAssistant ? "" : "flex-row-reverse"
                        }`}
                      >
                        <div
                          className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                            isAssistant
                              ? "bg-blue-500/10 text-blue-400"
                              : "bg-slate-700 text-slate-200"
                          }`}
                        >
                          {isAssistant ? (
                            <MessagesSquare size={17} />
                          ) : (
                            <UserRound size={17} />
                          )}
                        </div>

                        <div
                          className={`max-w-[85%] min-w-0 rounded-2xl border p-4 ${
                            isAssistant
                              ? "border-slate-700 bg-slate-800/70"
                              : "border-blue-500/20 bg-blue-500/10"
                          }`}
                        >
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-xs font-medium capitalize text-slate-300">
                              {message.role}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {formatDate(message.created_at)}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-200">
                            {message.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                ) : !detailLoading && detail ? (
                  <div className="py-16 text-center">
                    <MessageSquare
                      size={28}
                      className="mx-auto text-slate-600"
                    />
                    <p className="mt-3 text-sm text-slate-300">
                      No messages in this conversation.
                    </p>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <MessagesSquare size={34} className="text-slate-600" />
              <h2 className="mt-4 font-medium text-white">
                Select a conversation
              </h2>
              <p className="mt-2 max-w-sm text-sm text-slate-400">
                Choose a conversation from the list to inspect its saved messages.
              </p>
            </div>
          )}
        </section>
      </div>

      <p className="text-xs leading-5 text-slate-500">
        Access note: this page uses the current conversation endpoints. Admin
        authentication and customer-level access restrictions have not yet been
        implemented; do not expose these management routes publicly.
      </p>
    </div>
  );
}