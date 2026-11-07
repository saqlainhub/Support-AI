"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Bot,
  ChartNoAxesCombined,
  Files,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Settings,
  Users,
  X,
  Search,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  LoaderCircle,
  RefreshCw,
  LogOut,
  Pencil,
  Trash2,
} from "lucide-react";
import { apiRequest } from "@/lib/api";

type SidebarProps = {
  role: "admin" | "customer";
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

type ConversationSummary = {
  id: number;
  customer_id: number;
  created_at: string;
  title?: string | null;
};

type AuthStatusResponse = {
  authenticated: boolean;
  customer: {
    id: number;
    name: string;
    email: string;
    photo_url?: string | null;
    email_verified?: boolean;
    role?: string;
  } | null;
};

type MessageResponse = {
  message: string;
};

const customerItems = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Support Tickets", href: "/dashboard/tickets", icon: LifeBuoy },
];

const adminItems = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "Documents", href: "/admin/documents", icon: Files },
  { label: "Customers", href: "/admin/customers", icon: Users },
  {
    label: "Conversations",
    href: "/admin/conversations",
    icon: MessageSquare,
  },
  { label: "Support Tickets", href: "/admin/tickets", icon: LifeBuoy },
  { label: "AI Usage", href: "/admin/usage", icon: ChartNoAxesCombined },
  { label: "System Activity", href: "/admin/activity", icon: Activity },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

function conversationTitle(conversation: ConversationSummary) {
  return conversation.title?.trim() || `Conversation #${conversation.id}`;
}

// Supports both relative backend paths and absolute photo URLs.
function getProfilePhotoUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) return null;

  if (/^https?:\/\//i.test(photoUrl)) {
    return photoUrl;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, "");

  if (!apiUrl) {
    return photoUrl;
  }

  return `${apiUrl}/${photoUrl.replace(/^\/+/, "")}`;
}

export default function Sidebar({
  role,
  open,
  onClose,
  collapsed,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const [busyConversationId, setBusyConversationId] = useState<number | null>(
    null
  );
  const [customerName, setCustomerName] = useState("Customer");
  const [customerPhoto, setCustomerPhoto] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);

  const isCustomer = role === "customer";
  const isConversationPage = pathname === "/dashboard/conversations";
  const selectedConversation = searchParams.get("conversation");

  const action =
    searchParams.get("new") === "1"
      ? "new"
      : searchParams.get("search") === "1"
        ? "search"
        : null;

  // Load the signed-in customer's profile using the session cookie.
  const loadCustomerProfile = useCallback(async () => {
    if (!isCustomer) return;

    try {
      const result = await apiRequest<AuthStatusResponse>("/auth/me");

      if (result.authenticated && result.customer) {
        setAuthenticated(true);
        setCustomerName(result.customer.name || "Customer");
        setCustomerPhoto(result.customer.photo_url || null);
      } else {
        setAuthenticated(false);
        setCustomerName("Customer");
        setCustomerPhoto(null);
      }
    } catch {
      setAuthenticated(false);
      setCustomerName("Customer");
      setCustomerPhoto(null);
    }
  }, [isCustomer]);

  // Load conversation history for the authenticated customer.
  const loadConversations = useCallback(async () => {
    if (!isCustomer) return;

    setHistoryLoading(true);
    setHistoryError(false);

    try {
      const auth = await apiRequest<AuthStatusResponse>("/auth/me");

      if (!auth.authenticated || !auth.customer) {
        setAuthenticated(false);
        setCustomerName("Customer");
        setCustomerPhoto(null);
        setConversations([]);
        return;
      }

      setAuthenticated(true);
      setCustomerName(auth.customer.name || "Customer");
      setCustomerPhoto(auth.customer.photo_url || null);

      const result = await apiRequest<ConversationSummary[]>(
        "/customer/conversations"
      );

      setConversations(result);
    } catch {
      setHistoryError(true);
    } finally {
      setHistoryLoading(false);
    }
  }, [isCustomer]);

  useEffect(() => {
    if (!isCustomer) return;

    void loadCustomerProfile();
    void loadConversations();
  }, [isCustomer, loadCustomerProfile, loadConversations]);

  useEffect(() => {
    if (open && isCustomer) {
      void loadConversations();
    }
  }, [open, isCustomer, loadConversations]);

  function isItemActive(href: string) {
    const [path] = href.split("?");

    if (path !== pathname) return false;

    if (path === "/dashboard" || path === "/admin") {
      return pathname === path;
    }

    return pathname === path || pathname.startsWith(`${path}/`);
  }

  async function renameConversation(conversation: ConversationSummary) {
    const currentTitle = conversationTitle(conversation);
    const enteredTitle = window.prompt(
      "Enter a new conversation title:",
      currentTitle
    );

    if (enteredTitle === null) return;

    const title = enteredTitle.trim();

    if (!title) {
      window.alert("The conversation title cannot be empty.");
      return;
    }

    if (title.length > 120) {
      window.alert("The title must not exceed 120 characters.");
      return;
    }

    if (title === currentTitle) return;

    setBusyConversationId(conversation.id);

    try {
      const result = await apiRequest<{ id: number; title: string }>(
        `/customer/conversations/${conversation.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title }),
        }
      );

      setConversations((current) =>
        current.map((item) =>
          item.id === conversation.id
            ? { ...item, title: result.title || title }
            : item
        )
      );
    } catch {
      window.alert("Could not rename this conversation. Please try again.");
    } finally {
      setBusyConversationId(null);
    }
  }

  async function deleteConversation(conversation: ConversationSummary) {
    const confirmed = window.confirm(
      `Delete "${conversationTitle(conversation)}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    setBusyConversationId(conversation.id);

    try {
      await apiRequest<{ message: string; conversation_id: number }>(
        `/customer/conversations/${conversation.id}`,
        { method: "DELETE" }
      );

      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id)
      );

      if (
        isConversationPage &&
        selectedConversation === String(conversation.id)
      ) {
        router.push("/dashboard/conversations");
      }
    } catch {
      window.alert("Could not delete this conversation. Please try again.");
    } finally {
      setBusyConversationId(null);
    }
  }

  // Invalidate the backend session before navigating to login.
  async function handleLogout() {
    if (logoutLoading) return;

    setLogoutLoading(true);

    try {
      await apiRequest<MessageResponse>("/auth/logout", {
        method: "POST",
      });

      setConversations([]);
      setAuthenticated(false);
      setCustomerName("Customer");
      setCustomerPhoto(null);

      onClose();
      router.replace("/login");
      router.refresh();
    } catch {
      window.alert("Could not log out. Please try again.");
    } finally {
      setLogoutLoading(false);
    }
  }

  const items = isCustomer ? customerItems : adminItems;
  const profileInitial = isCustomer
    ? customerName.trim().charAt(0).toUpperCase() || "U"
    : "A";
  const profilePhotoUrl = getProfilePhotoUrl(customerPhoto);

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.07] bg-[#0b1120] transition-[width,transform] duration-200 ease-in-out
          ${collapsed ? "w-[76px]" : "w-70"}
          ${open ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0`}
      >
        {/* Logo row and collapse control */}
        <div
          className={`relative flex h-[72px] shrink-0 items-center border-b border-white/[0.07]
            ${collapsed ? "justify-center px-2" : "justify-between px-4"}`}
        >
          <div className="group/logo relative flex min-w-0 flex-1 items-center">
            {collapsed ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                aria-label="Expand sidebar"
                title="Expand sidebar"
                className="group/icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20 transition-colors hover:bg-blue-500/20 hover:text-blue-300"
              >
                <span className="block group-hover/icon:hidden">
                  <Bot size={23} strokeWidth={1.8} />
                </span>
                <span className="hidden group-hover/icon:block">
                  <PanelLeftOpen size={23} strokeWidth={1.8} />
                </span>
              </button>
            ) : (
              <Link
                href={isCustomer ? "/dashboard" : "/admin"}
                onClick={onClose}
                title="SupportAI home"
                className="flex min-w-0 flex-1 items-center gap-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 ring-1 ring-inset ring-blue-500/20">
                  <Bot size={23} strokeWidth={1.8} />
                </div>

                <div className="min-w-0">
                  <p className="font-semibold tracking-tight text-white">
                    SupportAI
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {isCustomer ? "Customer workspace" : "Administration"}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="ml-2 hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-white/[0.08] hover:text-white lg:flex"
            >
              <PanelLeftClose size={17} />
            </button>
          )}

          <button
            onClick={onClose}
            aria-label="Close sidebar"
            className="ml-1 rounded-lg p-2 text-slate-400 hover:bg-white/5 lg:hidden"
          >
            <X size={19} />
          </button>
        </div>

        {/* Navigation area */}
        <div
          className={`sidebar-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pt-4 ${
            collapsed ? "px-2" : "px-3"
          }`}
        >
          {!collapsed && (
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              {isCustomer ? "Your workspace" : "Workspace"}
            </p>
          )}

          <nav className="space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  title={collapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-11 items-center rounded-xl text-[13px] font-medium transition-colors
                    ${collapsed ? "justify-center px-0" : "gap-3 px-3"}
                    ${
                      active
                        ? "bg-blue-500/10 text-blue-300 ring-1 ring-inset ring-blue-500/20"
                        : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-100"
                    }`}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.8}
                    className={`shrink-0 ${
                      active
                        ? "text-blue-400"
                        : "text-slate-500 group-hover:text-slate-300"
                    }`}
                  />

                  {!collapsed && (
                    <>
                      <span className="min-w-0 flex-1">{item.label}</span>
                      {active && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Customer conversation history */}
          {isCustomer && (
            <section className={collapsed ? "mt-6" : "mt-7"}>
              <div
                className={`mb-2 flex items-center ${
                  collapsed ? "justify-center" : "justify-between gap-1 px-3"
                }`}
              >
                {!collapsed && (
                  <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Conversations
                  </p>
                )}

                <div
                  className={`flex items-center ${
                    collapsed ? "flex-col gap-2" : "gap-0.5"
                  }`}
                >
                  <Link
                    href="/dashboard/conversations?new=1"
                    onClick={onClose}
                    title="Create conversation"
                    aria-label="Create conversation"
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-blue-500/10 hover:text-blue-300 ${
                      action === "new" && isConversationPage
                        ? "text-blue-300"
                        : "text-slate-500"
                    }`}
                  >
                    <Plus size={15} />
                  </Link>

                  <Link
                    href="/dashboard/conversations?search=1"
                    onClick={onClose}
                    title="Search conversations"
                    aria-label="Search conversations"
                    className={`flex h-7 w-7 items-center justify-center rounded-lg transition hover:bg-blue-500/10 hover:text-blue-300 ${
                      action === "search" && isConversationPage
                        ? "text-blue-300"
                        : "text-slate-500"
                    }`}
                  >
                    <Search size={14} />
                  </Link>

                  <button
                    type="button"
                    onClick={() => void loadConversations()}
                    disabled={historyLoading}
                    title="Refresh conversations"
                    aria-label="Refresh conversations"
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/[0.06] hover:text-slate-200 disabled:opacity-50"
                  >
                    {historyLoading ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <RefreshCw size={13} />
                    )}
                  </button>
                </div>
              </div>

              {collapsed ? (
                <div className="my-3 flex justify-center">
                  <span className="h-px w-8 bg-white/[0.08]" />
                </div>
              ) : historyLoading && conversations.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-500">
                  <LoaderCircle size={14} className="animate-spin" />
                  Loading conversations...
                </div>
              ) : authenticated === false && conversations.length === 0 ? (
                <p className="px-3 py-3 text-xs leading-5 text-slate-600">
                  Sign in to view your saved conversations.
                </p>
              ) : historyError && conversations.length === 0 ? (
                <button
                  type="button"
                  onClick={() => void loadConversations()}
                  className="px-3 py-3 text-left text-xs text-slate-500 hover:text-slate-300"
                >
                  Could not load conversations. Try again.
                </button>
              ) : conversations.length === 0 ? (
                <p className="px-3 py-3 text-xs leading-5 text-slate-600">
                  Your conversations will appear here.
                </p>
              ) : (
                <div className="space-y-1">
                  {conversations.map((conversation) => {
                    const active =
                      isConversationPage &&
                      selectedConversation === String(conversation.id);
                    const busy = busyConversationId === conversation.id;

                    return (
                      <div
                        key={conversation.id}
                        className={`group/conversation group flex min-h-10 items-center rounded-lg text-xs transition ${
                          active
                            ? "bg-blue-500/10 text-blue-200"
                            : "text-slate-400 hover:bg-white/[0.045] hover:text-slate-200"
                        } ${busy ? "opacity-60" : ""}`}
                      >
                        <Link
                          href={`/dashboard/conversations?conversation=${conversation.id}`}
                          onClick={onClose}
                          title={conversationTitle(conversation)}
                          aria-current={active ? "page" : undefined}
                          className={`flex min-w-0 flex-1 items-center self-stretch ${
                            collapsed ? "justify-center px-0" : "gap-2 pl-3"
                          }`}
                        >
                          <MessageSquare
                            size={14}
                            className={`shrink-0 ${
                              active ? "text-blue-300" : "text-slate-500"
                            }`}
                          />

                          {!collapsed && (
                            <span className="min-w-0 flex-1 truncate py-2">
                              {conversationTitle(conversation)}
                            </span>
                          )}
                        </Link>

                        {!collapsed && (
                          <div className="mr-1 flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/conversation:opacity-100 group-focus-within/conversation:opacity-100">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void renameConversation(conversation)
                              }
                              title="Rename conversation"
                              aria-label={`Rename ${conversationTitle(conversation)}`}
                              className="invisible flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-blue-500/15 hover:text-blue-300 group-hover/conversation:visible group-focus-within/conversation:visible disabled:cursor-wait"
                            >
                              {busy ? (
                                <LoaderCircle
                                  size={13}
                                  className="animate-spin"
                                />
                              ) : (
                                <Pencil size={13} />
                              )}
                            </button>

                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                void deleteConversation(conversation)
                              }
                              title="Delete conversation"
                              aria-label={`Delete ${conversationTitle(conversation)}`}
                              className="invisible flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-red-500/15 hover:text-red-400 group-hover/conversation:visible group-focus-within/conversation:visible disabled:cursor-wait"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Fixed profile footer */}
        <div className="shrink-0 border-t border-white/[0.07] bg-[#0b1120] p-3">
          {isCustomer ? (
            <Link
              href="/dashboard/settings"
              onClick={onClose}
              title={collapsed ? `${customerName} — Profile settings` : "Profile settings"}
              aria-label="Open profile settings"
              aria-current={pathname.startsWith("/dashboard/settings") ? "page" : undefined}
              className={`group/profile flex min-w-0 items-center rounded-xl transition-colors hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                collapsed ? "justify-center p-1" : "gap-3 px-1 py-2"
              }`}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/20 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 text-sm font-semibold text-blue-200">
                {profilePhotoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profilePhotoUrl}
                    alt={`${customerName}'s profile`}
                    className="h-full w-full object-cover"
                    onError={(event) => {
                      // Fall back to the customer's initial if the photo is unavailable.
                      event.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  profileInitial
                )}
                {profilePhotoUrl && (
                  <span className="sr-only">{profileInitial}</span>
                )}
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200 group-hover/profile:text-white">
                    {customerName}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500 group-hover/profile:text-slate-400">
                    {pathname.startsWith("/dashboard/settings")
                      ? "Profile settings"
                      : "Customer account · Settings"}
                  </p>
                </div>
              )}

              {!collapsed && (
                <Settings
                  size={15}
                  className="mr-1 shrink-0 text-slate-600 transition-colors group-hover/profile:text-blue-300"
                />
              )}
            </Link>
          ) : (
            <div
              className={`flex items-center ${
                collapsed ? "justify-center" : "gap-3 px-1"
              }`}
              title="Administrator"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-blue-400/20 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 text-sm font-semibold text-blue-200">
                {profileInitial}
              </div>

              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-200">
                    Administrator
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">
                    Admin workspace
                  </p>
                </div>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={logoutLoading}
            title="Log out"
            aria-label="Log out"
            className={`mt-3 flex min-h-10 w-full items-center rounded-xl text-sm text-red-400/80 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-wait disabled:opacity-60 ${
              collapsed ? "justify-center px-0" : "gap-3 px-3"
            }`}
          >
            {logoutLoading ? (
              <LoaderCircle size={17} className="shrink-0 animate-spin" />
            ) : (
              <LogOut size={17} className="shrink-0" />
            )}
            {!collapsed && (
              <span>{logoutLoading ? "Logging out..." : "Log out"}</span>
            )}
          </button>
        </div>
      </aside>

      <style jsx>{`
        .sidebar-scroll {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }

        .sidebar-scroll::-webkit-scrollbar {
          display: none;
          width: 0;
          height: 0;
        }
      `}</style>
    </>
  );
}
