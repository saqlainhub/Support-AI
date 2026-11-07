
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowUp,
  Bot,
  Check,
  CheckCheck,
  CircleAlert,
  Clipboard,
  FileText,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Pencil,
  RotateCcw,
  Search,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { getVisitorId } from "@/lib/visitor";

type Source = {
  document: string;
  page: number | null;
};

type ChatResponse = {
  response: string;
  sources: Source[];
  conversation_id: number;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

type ConversationSummary = {
  id: number;
  customer_id: number;
  created_at: string;
  title?: string | null;
};

type ConversationHistoryResponse = {
  conversation_id: number;
  title?: string | null;
  messages: {
    id: number;
    role: "user" | "assistant";
    content: string;
    created_at: string;
  }[];
};

type AuthStatus = {
  authenticated: boolean;
  customer?: {
    id: number;
    name: string | null;
    email: string;
  } | null;
};

const suggestions = [
  {
    title: "Explore our services",
    description: "Learn what support and services are available.",
    prompt: "What services do you provide?",
  },
  {
    title: "Find information",
    description: "Search for answers in the knowledge base.",
    prompt: "Help me find information in the knowledge base",
  },
  {
    title: "Get support",
    description: "Find the right next step for your question.",
    prompt: "How can I get support?",
  },
];

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getConversationTitle(conversation: ConversationSummary) {
  return conversation.title?.trim() || `Conversation #${conversation.id}`;
}

function getMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function ConversationsPage() {
  const searchParams = useSearchParams();

  const selectedConversationParam = searchParams.get("conversation");
  const newAction = searchParams.get("new") === "1";
  const searchAction = searchParams.get("search") === "1";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [conversationTitle, setConversationTitle] = useState("");
  const [visitorReady, setVisitorReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [copiedSource, setCopiedSource] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(
    null,
  );

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [openingConversationId, setOpeningConversationId] = useState<
    number | null
  >(null);

  const [searchOpen, setSearchOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");

  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renaming, setRenaming] = useState(false);

  const [composerExpanded, setComposerExpanded] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const expandedInputRef = useRef<HTMLTextAreaElement>(null);
  const handledLocationRef = useRef<string | null>(null);
  const openingRequestRef = useRef(0);

  // Initialize the anonymous visitor ID without blocking authenticated chat.
  useEffect(() => {
    let active = true;

    async function initializeVisitor() {
      try {
        await getVisitorId();
      } catch {
        // An authenticated customer can still chat without a visitor ID.
      } finally {
        if (active) {
          setVisitorReady(true);
        }
      }
    }

    void initializeVisitor();

    return () => {
      active = false;
    };
  }, []);

  // Customer history is available only to authenticated customers.
  // Anonymous visitors can still use /chat, but have no customer history.
  const loadConversations = useCallback(async () => {
    if (!visitorReady) return;

    setHistoryLoading(true);

    try {
      const authStatus = await apiRequest<AuthStatus>("/auth/me");

      if (!authStatus.authenticated) {
        setConversations([]);
        return;
      }

      const result = await apiRequest<ConversationSummary[]>(
        "/customer/conversations",
      );

      setConversations(Array.isArray(result) ? result : []);
    } catch (err) {
      setConversations([]);
      setError(
        `Could not load conversation history: ${
          err instanceof Error ? err.message : "Please try again."
        }`,
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [visitorReady]);

  useEffect(() => {
    if (visitorReady) {
      void loadConversations();
    }
  }, [visitorReady, loadConversations]);

  // Keep the latest message visible above the composer.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  const openConversation = useCallback(
    async (id: number) => {
      if (sending || openingConversationId !== null || renaming) return;

      const requestId = ++openingRequestRef.current;

      setOpeningConversationId(id);
      setError("");
      setRenameId(null);
      setSearchOpen(false);
      setEditingMessageId(null);

      try {
        const result = await apiRequest<ConversationHistoryResponse>(
          `/customer/conversations/${id}`,
        );

        if (requestId !== openingRequestRef.current) return;

        setConversationId(result.conversation_id);
        setConversationTitle(
          result.title?.trim() || `Conversation #${result.conversation_id}`,
        );

        setMessages(
          result.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            // The history API does not currently return source references.
            sources: [],
          })),
        );

        setInput("");
        setCopiedSource(null);
        setCopiedMessageId(null);

        window.history.replaceState(
          null,
          "",
          `/dashboard/conversations?conversation=${result.conversation_id}`,
        );

        handledLocationRef.current = `conversation:${result.conversation_id}`;
      } catch (err) {
        if (requestId === openingRequestRef.current) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not open this conversation.",
          );
        }
      } finally {
        if (requestId === openingRequestRef.current) {
          setOpeningConversationId(null);
        }
      }
    },
    [sending, openingConversationId, renaming],
  );

  // Handle new-chat, search and conversation URLs.
  useEffect(() => {
    if (!visitorReady) return;

    const locationKey = selectedConversationParam
      ? `conversation:${selectedConversationParam}`
      : newAction
        ? "new"
        : searchAction
          ? "search"
          : "default";

    if (handledLocationRef.current === locationKey) return;

    handledLocationRef.current = locationKey;

    if (selectedConversationParam) {
      const id = Number(selectedConversationParam);

      if (Number.isInteger(id) && id > 0) {
        void openConversation(id);
      }

      return;
    }

    if (newAction) {
      openingRequestRef.current += 1;
      setOpeningConversationId(null);
      setConversationId(null);
      setConversationTitle("");
      setMessages([]);
      setInput("");
      setError("");
      setCopiedSource(null);
      setCopiedMessageId(null);
      setEditingMessageId(null);
      setRenameId(null);
      setSearchOpen(false);
      setComposerExpanded(false);

      window.history.replaceState(null, "", "/dashboard/conversations");

      window.setTimeout(() => inputRef.current?.focus(), 50);
      return;
    }

    if (searchAction) {
      setSearchOpen(true);

      window.history.replaceState(null, "", "/dashboard/conversations");

      window.setTimeout(() => {
        document.getElementById("conversation-history-search")?.focus();
      }, 50);

      return;
    }

    setConversationId(null);
    setConversationTitle("");
    setMessages([]);
  }, [
    visitorReady,
    selectedConversationParam,
    newAction,
    searchAction,
    openConversation,
  ]);

  const startNewConversation = useCallback(() => {
    if (sending || openingConversationId !== null || renaming) return;

    openingRequestRef.current += 1;
    setOpeningConversationId(null);
    setMessages([]);
    setConversationId(null);
    setConversationTitle("");
    setInput("");
    setError("");
    setCopiedSource(null);
    setCopiedMessageId(null);
    setEditingMessageId(null);
    setRenameId(null);
    setRenameValue("");
    setSearchOpen(false);
    setHistoryQuery("");
    setComposerExpanded(false);

    handledLocationRef.current = "default";

    window.history.replaceState(null, "", "/dashboard/conversations");

    window.setTimeout(() => inputRef.current?.focus(), 50);
  }, [sending, openingConversationId, renaming]);

  const renameConversation = useCallback(
    async (id: number) => {
      const title = renameValue.trim();

      if (!title) {
        setError("Conversation title cannot be empty.");
        return;
      }

      if (title.length > 120) {
        setError("Conversation title cannot exceed 120 characters.");
        return;
      }

      setRenaming(true);
      setError("");

      try {
        await apiRequest<ConversationSummary>(
          `/customer/conversations/${id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ title }),
          },
        );

        setConversations((previous) =>
          previous.map((conversation) =>
            conversation.id === id ? { ...conversation, title } : conversation,
          ),
        );

        if (conversationId === id) {
          setConversationTitle(title);
        }

        setRenameId(null);
        setRenameValue("");

        await loadConversations();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not rename this conversation.",
        );
      } finally {
        setRenaming(false);
      }
    },
    [renameValue, conversationId, loadConversations],
  );

  const sendMessage = useCallback(
    async (messageText?: string, options?: { keepInput?: boolean }) => {
      const message = (messageText ?? input).trim();

      if (
        !message ||
        sending ||
        !visitorReady ||
        openingConversationId !== null ||
        renaming
      ) {
        return;
      }

      setError("");

      if (!options?.keepInput) setInput("");

      setSending(true);
      setComposerExpanded(false);

      const userMessage: ChatMessage = {
        id: getMessageId(),
        role: "user",
        content: message,
      };

      setMessages((previous) => [...previous, userMessage]);

      try {
        let isAuthenticated = false;

        try {
          const authStatus = await apiRequest<AuthStatus>("/auth/me");
          isAuthenticated = authStatus.authenticated;
        } catch {
          // If the session check fails, attempt the anonymous flow.
        }

        const requestBody: {
          message: string;
          conversation_id: number | null;
          visitor_id?: string;
        } = {
          message,
          conversation_id: conversationId,
        };

        if (!isAuthenticated) {
          requestBody.visitor_id = await getVisitorId();
        }

        const result = await apiRequest<ChatResponse>("/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        });

        setConversationId(result.conversation_id);

        setMessages((previous) => [
          ...previous,
          {
            id: getMessageId(),
            role: "assistant",
            content: result.response,
            sources: result.sources ?? [],
          },
        ]);

        if (conversationId === null) {
          setConversationTitle(message.slice(0, 60));

          window.history.replaceState(
            null,
            "",
            `/dashboard/conversations?conversation=${result.conversation_id}`,
          );

          handledLocationRef.current = `conversation:${result.conversation_id}`;
        }

        await loadConversations();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not send your message. Please try again.",
        );

        if (!options?.keepInput) setInput(message);
      } finally {
        setSending(false);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
    },
    [
      input,
      sending,
      visitorReady,
      openingConversationId,
      renaming,
      conversationId,
      loadConversations,
    ],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void sendMessage();
    }
  }

  const copyMessage = useCallback(async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);

      window.setTimeout(() => {
        setCopiedMessageId((current) =>
          current === message.id ? null : current,
        );
      }, 1500);
    } catch {
      setError("Could not copy this message.");
    }
  }, []);

  const editMessage = useCallback(
    (message: ChatMessage) => {
      if (sending || openingConversationId !== null || renaming) return;

      setInput(message.content);
      setEditingMessageId(message.id);
      setError("");
      setComposerExpanded(false);

      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(
          message.content.length,
          message.content.length,
        );
      }, 0);
    },
    [sending, openingConversationId, renaming],
  );

  const canInteract =
    visitorReady &&
    !sending &&
    openingConversationId === null &&
    !renaming;

  const regenerateResponse = useCallback(
    async (message: ChatMessage) => {
      if (message.role !== "assistant" || !canInteract) return;

      const messageIndex = messages.findIndex((item) => item.id === message.id);

      // Find the nearest preceding user prompt for this assistant response.
      let precedingPrompt: ChatMessage | undefined;

      for (let index = messageIndex - 1; index >= 0; index -= 1) {
        if (messages[index].role === "user") {
          precedingPrompt = messages[index];
          break;
        }
      }

      if (!precedingPrompt) {
        setError("Could not find the prompt for this response.");
        return;
      }

      // Reuse the existing chat endpoint.
      await sendMessage(precedingPrompt.content);
    },
    [canInteract, messages, sendMessage],
  );

  const copySource = useCallback(async (source: Source, key: string) => {
    const text =
      source.page !== null
        ? `${source.document} — Page ${source.page}`
        : source.document;

    try {
      await navigator.clipboard.writeText(text);
      setCopiedSource(key);

      window.setTimeout(() => {
        setCopiedSource((current) => (current === key ? null : current));
      }, 1500);
    } catch {
      setError("Could not copy the source reference.");
    }
  }, []);

  const filteredConversations = conversations.filter((conversation) =>
    getConversationTitle(conversation)
      .toLowerCase()
      .includes(historyQuery.trim().toLowerCase()),
  );

  // Default height is two lines; grow to five lines, then scroll internally.
  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const minHeight = 72;
    const maxHeight = 144;

    textarea.style.height = "auto";

    const nextHeight = Math.max(
      minHeight,
      Math.min(textarea.scrollHeight, maxHeight),
    );

    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY =
      textarea.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [input]);

  useEffect(() => {
    if (!composerExpanded) return;

    const textarea = expandedInputRef.current;
    if (!textarea) return;

    textarea.focus();
    textarea.setSelectionRange(input.length, input.length);
  }, [composerExpanded, input]);

  const actionButtonClass =
    "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-400 opacity-0 transition duration-150 hover:border-white/10 hover:bg-white/[0.07] hover:text-slate-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 group-hover/message:opacity-100 group-focus-within/message:opacity-100 disabled:pointer-events-none disabled:opacity-30";

  return (
    <main className="relative flex h-dvh min-h-0 flex-col overflow-hidden bg-[#0a101d] text-slate-100">
      {/* Search remains available through the existing ?search=1 action. */}
      {searchOpen && (
        <div className="absolute left-1/2 top-16 z-30 w-[min(900px,calc(100vw-32px))] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#0d1626] p-3 shadow-2xl sm:right-6">
          <div className="mb-3 flex items-center gap-2">
            <Search size={17} className="shrink-0 text-slate-400" />
            <input
              id="conversation-history-search"
              value={historyQuery}
              onChange={(event) => setHistoryQuery(event.target.value)}
              placeholder="Search conversations..."
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                setHistoryQuery("");
              }}
              aria-label="Close conversation search"
              title="Close search"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              <X size={17} />
            </button>
          </div>

          <div className="max-h-72 space-y-1 overflow-y-auto">
            {historyLoading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-slate-400">
                <LoaderCircle size={16} className="animate-spin" />
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500">
                No conversations found.
              </p>
            ) : (
              filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="rounded-xl px-2 py-2 transition hover:bg-white/[0.05]"
                >
                  {renameId === conversation.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={renameValue}
                        maxLength={120}
                        onChange={(event) =>
                          setRenameValue(event.target.value)
                        }
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void renameConversation(conversation.id);
                          }

                          if (event.key === "Escape") {
                            setRenameId(null);
                            setRenameValue("");
                          }
                        }}
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-[#080e19] px-2 py-1.5 text-sm outline-none focus:border-blue-500"
                      />

                      <button
                        type="button"
                        disabled={renaming}
                        onClick={() =>
                          void renameConversation(conversation.id)
                        }
                        aria-label="Save conversation title"
                        title="Save title"
                        className="rounded-lg p-1.5 text-emerald-400 hover:bg-white/10 disabled:opacity-50"
                      >
                        {renaming ? (
                          <LoaderCircle size={16} className="animate-spin" />
                        ) : (
                          <Check size={16} />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(null);
                          setRenameValue("");
                        }}
                        aria-label="Cancel rename"
                        title="Cancel rename"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => void openConversation(conversation.id)}
                        disabled={
                          sending || openingConversationId !== null || renaming
                        }
                        className="min-w-0 flex-1 text-left disabled:opacity-50"
                      >
                        <span className="block truncate text-sm text-slate-200">
                          {getConversationTitle(conversation)}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {formatDate(conversation.created_at)}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setRenameId(conversation.id);
                          setRenameValue(getConversationTitle(conversation));
                        }}
                        aria-label="Rename conversation"
                        title="Rename conversation"
                        className="rounded-lg p-1.5 text-slate-500 transition hover:bg-white/10 hover:text-white"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  )}

                  {openingConversationId === conversation.id && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-blue-300">
                      <LoaderCircle size={13} className="animate-spin" />
                      Opening conversation...
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main conversation area. */}
      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-36 pt-5 sm:px-5">
        {messages.length === 0 && !sending ? (
          <div className="flex flex-1 flex-col items-center justify-center px-1 pb-4 pt-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-blue-400/20 bg-blue-500/10 text-blue-300">
              <Bot size={29} strokeWidth={1.7} />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight text-slate-100 sm:text-3xl">
              How can I help?
            </h1>

            <p className="mt-2 text-sm text-slate-400">
              Ask your support question.
            </p>

            <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
              Find answers, explore services, or get help using the knowledge
              base.
            </p>

            <div className="mt-7 grid w-full max-w-4xl grid-cols-1 gap-3 sm:grid-cols-3">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.title}
                  type="button"
                  onClick={() => void sendMessage(suggestion.prompt)}
                  disabled={!canInteract}
                  className="group flex min-w-0 items-start gap-3 rounded-xl border border-white/[0.08] bg-[#0d1626] px-3.5 py-3 text-left transition hover:border-blue-400/30 hover:bg-[#111d31] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-[112px] sm:flex-col sm:gap-2.5 sm:p-4"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300 transition group-hover:bg-blue-500/15">
                    {suggestion.title === "Explore our services" ? (
                      <Sparkles size={17} />
                    ) : suggestion.title === "Find information" ? (
                      <Search size={17} />
                    ) : (
                      <MessageSquare size={17} />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200">
                      {suggestion.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {suggestion.description}
                    </p>
                  </div>

                  <ArrowUp
                    size={15}
                    className="-rotate-45 mt-1 shrink-0 text-slate-600 transition group-hover:text-blue-300 sm:hidden"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-5">
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isCopied = copiedMessageId === message.id;

              return (
                <div
                  key={message.id}
                  className={`group/message flex min-w-0 gap-2.5 sm:gap-3 ${
                    isUser ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                      isUser
                        ? "bg-blue-500/15 text-blue-300"
                        : "border border-white/[0.08] bg-[#111a2a] text-slate-300"
                    }`}
                  >
                    {isUser ? (
                      <UserRound size={16} />
                    ) : (
                      <Bot size={17} />
                    )}
                  </div>

                  <div
                    className={`flex min-w-0 max-w-[calc(100%-2.75rem)] flex-col ${
                      isUser ? "items-end" : "items-start"
                    }`}
                  >
                    <span className="mb-1.5 px-1 text-xs font-medium text-slate-500">
                      {isUser ? "You" : "AI Assistant"}
                    </span>

                    <div
                      className={`max-w-full whitespace-pre-wrap break-words rounded-2xl px-3.5 py-3 text-sm leading-6 sm:px-4 ${
                        isUser
                          ? "rounded-tr-md bg-blue-600 text-white"
                          : "rounded-tl-md border border-white/[0.05] bg-[#111a2a] text-slate-200"
                      }`}
                    >
                      {message.content}
                    </div>

                    {/* Message actions appear on this message's hover/focus. */}
                    <div
                      className={`mt-1 flex items-center gap-1 ${
                        isUser ? "justify-end" : "justify-start"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => void copyMessage(message)}
                        disabled={!canInteract}
                        aria-label={isCopied ? "Message copied" : "Copy message"}
                        className={`${actionButtonClass} group`}
                      >
                        {isCopied ? (
                          <CheckCheck
                            size={15}
                            className="text-emerald-400"
                          />
                        ) : (
                          <Clipboard size={15} />
                        )}
                        <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#080e19] px-2 py-1 text-xs text-slate-200 shadow-lg group-hover:block group-focus-within/message:hidden">
                          {isCopied ? "Copied" : "Copy message"}
                        </span>
                      </button>

                      {isUser ? (
                        <button
                          type="button"
                          onClick={() => editMessage(message)}
                          disabled={!canInteract}
                          aria-label="Edit message"
                          className={`${actionButtonClass} group`}
                        >
                          <Pencil size={15} />
                          <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#080e19] px-2 py-1 text-xs text-slate-200 shadow-lg group-hover:block group-focus-within/message:hidden">
                            Edit prompt
                          </span>
                        </button>
                      ) : (
                        <>
                          {message.sources && message.sources.length > 0 && (
                            <div className="group/sources relative">
                              <button
                                type="button"
                                aria-label="View answer sources"
                                className={actionButtonClass}
                              >
                                <FileText size={15} />
                              </button>

                              <div className="absolute left-0 top-full z-40 mt-1 hidden w-72 max-w-[75vw] rounded-xl border border-white/10 bg-[#0b1322] shadow-xl group-hover/sources:block group-focus-within/sources:block">
                                {message.sources.map((source, index) => {
                                  const key = `${message.id}-${index}`;
                                  const copied = copiedSource === key;

                                  return (
                                    <button
                                      key={key}
                                      type="button"
                                      onClick={() =>
                                        void copySource(source, key)
                                      }
                                      title="Copy source reference"
                                      className="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.06]"
                                    >
                                      {copied ? (
                                        <CheckCheck
                                          size={14}
                                          className="mt-0.5 shrink-0 text-emerald-400"
                                        />
                                      ) : (
                                        <FileText
                                          size={14}
                                          className="mt-0.5 shrink-0 text-blue-300"
                                        />
                                      )}

                                      <span className="min-w-0 break-words text-xs leading-5 text-slate-300">
                                        {source.document}
                                        {source.page !== null &&
                                          ` — Page ${source.page}`}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => void regenerateResponse(message)}
                            disabled={!canInteract}
                            aria-label="Regenerate response"
                            className={`${actionButtonClass} group`}
                          >
                            <RotateCcw size={15} />
                            <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-white/10 bg-[#080e19] px-2 py-1 text-xs text-slate-200 shadow-lg group-hover:block group-focus-within/message:hidden">
                              Regenerate response
                            </span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-start gap-2.5 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-[#111a2a] text-slate-300">
                  <Bot size={17} />
                </div>

                <div className="min-w-0">
                  <span className="mb-1.5 block px-1 text-xs font-medium text-slate-500">
                    AI Assistant
                  </span>

                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-white/[0.05] bg-[#111a2a] px-4 py-3 text-sm text-slate-400">
                    <LoaderCircle
                      size={15}
                      className="animate-spin text-blue-400"
                    />
                    Searching and preparing an answer...
                  </div>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </section>

      {/* Error message remains above the composer. */}
      {error && (
        <div className="fixed bottom-[165px] left-3 right-3 z-20 mx-auto flex max-w-4xl items-start gap-2 rounded-xl border border-red-400/20 bg-[#190f19] px-3 py-2.5 text-sm text-red-300 shadow-lg sm:bottom-[170px]">
          <CircleAlert size={17} className="mt-0.5 shrink-0" />
          <p className="min-w-0 flex-1 break-words">{error}</p>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="Dismiss error"
            title="Dismiss error"
            className="shrink-0 rounded p-0.5 text-red-300/70 transition hover:text-red-200"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Composer stays centered within the content area. */}
      <footer className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-[#0a101d] via-[#0a101d]/[0.98] to-[#0a101d]/90 px-3 pb-5 pt-3 sm:px-5 sm:pb-6">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setEditingMessageId(null);
            void sendMessage();
          }}
          className="mx-auto w-full max-w-4xl"
        >
          {editingMessageId && (
            <div className="mb-2 flex items-center justify-between rounded-lg border border-blue-400/20 bg-blue-500/[0.06] px-3 py-2 text-xs text-blue-200">
              <span>Editing prompt — update it before sending.</span>
              <button
                type="button"
                onClick={() => {
                  setEditingMessageId(null);
                  setInput("");
                }}
                title="Cancel editing"
                aria-label="Cancel editing"
                className="rounded p-1 text-blue-200/70 hover:bg-white/[0.08] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="relative rounded-[18px] border border-white/[0.12] bg-[#111a2a] shadow-lg shadow-black/20 transition focus-within:border-blue-400/35">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={2}
              disabled={!visitorReady || sending}
              aria-label="Your message"
              className="block min-h-[80px] max-h-[144px] w-full resize-none overflow-y-hidden rounded-[18px] bg-transparent py-3 pl-4 pr-12 text-sm leading-6 text-slate-100 outline-none placeholder:text-slate-500 disabled:opacity-50"
            />

            <div className="absolute bottom-2 right-2 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setComposerExpanded(true)}
                disabled={!visitorReady || sending}
                title="Expand prompt editor"
                aria-label="Expand prompt"
                className="flex h-7 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.08] hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-40"
              >
                <Maximize2 size={15} />
              </button>

              <button
                type="submit"
                disabled={!input.trim() || !canInteract}
                aria-label="Send message"
                title={editingMessageId ? "Send edited prompt" : "Send message"}
                className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:cursor-not-allowed disabled:bg-[#263247] disabled:text-slate-500"
              >
                {sending ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </form>
      </footer>

      {/* Expanded prompt editor. */}
      {composerExpanded && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setComposerExpanded(false);
            }
          }}
        >
          <div className="flex max-h-[85dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0d1626] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3">
              <span className="text-sm font-medium text-slate-300">
                {editingMessageId ? "Edit your prompt" : "Your message"}
              </span>

              <button
                type="button"
                onClick={() => setComposerExpanded(false)}
                aria-label="Close expanded prompt"
                title="Close expanded prompt"
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <textarea
              ref={expandedInputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  setEditingMessageId(null);
                  void sendMessage();
                }

                if (event.key === "Escape") {
                  setComposerExpanded(false);
                }
              }}
              placeholder="Ask anything..."
              disabled={!visitorReady || sending}
              aria-label="Expanded message editor"
              className="min-h-[220px] w-full flex-1 resize-y bg-transparent px-4 py-4 text-sm leading-7 text-slate-100 outline-none placeholder:text-slate-500 sm:min-h-[300px]"
            />

            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-white/[0.08] px-4 py-3">
              <button
                type="button"
                onClick={() => setComposerExpanded(false)}
                className="rounded-xl px-4 py-2 text-sm text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingMessageId(null);
                  void sendMessage();
                }}
                disabled={!input.trim() || !canInteract}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-[#263247] disabled:text-slate-500"
                aria-label="Send message"
                title={editingMessageId ? "Send edited prompt" : "Send message"}
              >
                {sending ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <ArrowUp size={18} strokeWidth={2.5} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
