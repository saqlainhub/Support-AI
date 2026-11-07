
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  LifeBuoy,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { getVisitorId } from "@/lib/visitor";

const features = [
  {
    icon: MessageSquareText,
    title: "AI conversations",
    description:
      "Get clear answers to your questions using information from the available knowledge base.",
    href: "/dashboard/conversations",
    action: "Start a conversation",
    label: "AI ASSISTANT",
    iconStyle: "bg-blue-500/10 text-blue-400",
  },
  {
    icon: LifeBuoy,
    title: "Support tickets",
    description:
      "Review your support requests and keep track of issues that need follow-up.",
    href: "/dashboard/tickets",
    action: "View support tickets",
    label: "SUPPORT CENTER",
    iconStyle: "bg-violet-500/10 text-violet-400",
  },
];

const steps = [
  {
    number: "01",
    title: "Ask your question",
    description: "Explain what you need help with.",
  },
  {
    number: "02",
    title: "Get an answer",
    description: "The AI searches available support information.",
  },
  {
    number: "03",
    title: "Create a ticket",
    description: "Use support tickets for issues needing follow-up.",
  },
];

export default function CustomerDashboard() {
  const [visitorReady, setVisitorReady] = useState(false);

  useEffect(() => {
    try {
      getVisitorId();
      setVisitorReady(true);
    } catch (error) {
      console.error("Unable to initialize visitor identity:", error);
    }
  }, []);

  return (
    <main className="space-y-8 pb-8">
      {/* Welcome header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-blue-400">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
            Customer workspace
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Welcome to your support desk
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Find answers, explore support resources, and manage your support
            requests in one place.
          </p>
        </div>

        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-xs text-slate-400">
          {visitorReady ? (
            <>
              <CheckCircle2 size={14} className="text-emerald-400" />
              Workspace initialized
            </>
          ) : (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-slate-500" />
              Initializing workspace
            </>
          )}
        </div>
      </header>

      {/* Hero section */}
      <section className="relative isolate overflow-hidden rounded-3xl border border-blue-400/15 bg-[#0c1527]">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.20),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(99,102,241,0.10),transparent_50%)]" />

        <div className="pointer-events-none absolute -right-16 top-8 -z-10 h-64 w-64 rounded-full border border-blue-400/[0.08]" />
        <div className="pointer-events-none absolute -right-4 top-20 -z-10 h-40 w-40 rounded-full border border-blue-400/[0.10]" />

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_260px] lg:items-center lg:p-10">
          <div className="max-w-2xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/[0.08] px-3 py-1.5 text-xs font-medium text-blue-300">
              <Sparkles size={14} />
              AI-POWERED SUPPORT
            </div>

            <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl lg:text-[42px]">
              How can we
              <span className="text-blue-400"> help you </span>
              today?
            </h2>

            <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400 sm:text-base">
              Start with a question. Our AI assistant can help you find
              information from the available knowledge base and guide you
              toward the right support resources.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard/conversations"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-950/30 transition hover:bg-blue-500"
              >
                <MessageSquareText size={17} />
                Start a conversation
                <ArrowRight
                  size={16}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>

              <Link
                href="/dashboard/tickets"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm font-medium text-slate-200 transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <LifeBuoy size={17} />
                Manage support
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Zap size={13} className="text-blue-400" />
                AI-assisted answers
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock3 size={13} />
                Available anytime
              </span>
            </div>
          </div>

          {/* Decorative assistant illustration */}
          <div className="hidden lg:flex lg:justify-center">
            <div className="relative flex h-56 w-56 items-center justify-center">
              <div className="absolute inset-0 rounded-full border border-blue-400/10" />
              <div className="absolute inset-5 rounded-full border border-blue-400/[0.12]" />
              <div className="absolute inset-10 rounded-full bg-blue-500/[0.08] blur-xl" />

              <div className="relative flex h-28 w-28 items-center justify-center rounded-[30px] border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 shadow-2xl shadow-blue-950/40">
                <Bot size={54} strokeWidth={1.3} className="text-blue-300" />

                <span className="absolute -right-3 -top-3 flex h-9 w-9 items-center justify-center rounded-xl border border-blue-400/20 bg-[#111d33] text-blue-300">
                  <Sparkles size={17} />
                </span>

                <span className="absolute -bottom-3 -left-3 flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-[#10251f] text-emerald-400">
                  <CheckCircle2 size={17} />
                </span>
              </div>

              <div className="absolute right-0 top-8 rounded-xl border border-white/[0.08] bg-[#111a2b] px-3 py-2 text-xs text-slate-300 shadow-xl">
                <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Ready to assist
              </div>

              <div className="absolute bottom-5 left-0 rounded-xl border border-white/[0.08] bg-[#111a2b] px-3 py-2 text-xs text-slate-300 shadow-xl">
                Smart support
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Support options */}
      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Your support tools
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Choose the best way to get help.
            </p>
          </div>

          <span className="hidden text-xs text-slate-500 sm:block">
            2 available services
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <Link
                key={feature.title}
                href={feature.href}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d1423] p-5 transition duration-200 hover:-translate-y-0.5 hover:border-blue-400/25 hover:bg-[#101a2c] sm:p-6"
              >
                <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-blue-500/[0.03] blur-2xl transition group-hover:bg-blue-500/[0.08]" />

                <div className="relative flex items-start justify-between gap-4">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${feature.iconStyle}`}
                  >
                    <Icon size={23} strokeWidth={1.8} />
                  </div>

                  <span className="rounded-full border border-white/[0.07] bg-white/[0.02] px-2.5 py-1 text-[10px] font-medium tracking-wider text-slate-500">
                    {feature.label}
                  </span>
                </div>

                <h3 className="relative mt-5 text-base font-semibold text-white">
                  {feature.title}
                </h3>

                <p className="relative mt-2 min-h-[48px] max-w-md text-sm leading-6 text-slate-400">
                  {feature.description}
                </p>

                <div className="relative mt-5 flex items-center justify-between border-t border-white/[0.06] pt-4">
                  <span className="text-sm font-medium text-blue-400">
                    {feature.action}
                  </span>

                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.07] text-slate-400 transition group-hover:border-blue-400/20 group-hover:bg-blue-500/10 group-hover:text-blue-300">
                    <ChevronRight size={17} />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="rounded-2xl border border-white/[0.07] bg-[#0b111e] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Getting started is simple
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A straightforward path from question to resolution.
            </p>
          </div>

          <CircleHelp size={20} className="hidden text-slate-600 sm:block" />
        </div>

        <div className="mt-6 grid gap-5 sm:grid-cols-3 sm:gap-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative flex gap-3 sm:block">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-400/15 bg-blue-500/[0.07] text-xs font-semibold text-blue-300">
                {step.number}
              </div>

              <div className="pt-0.5 sm:mt-4">
                <h3 className="text-sm font-medium text-slate-200">
                  {step.title}
                </h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  {step.description}
                </p>
              </div>

              {index < steps.length - 1 && (
                <ArrowDownRight
                  size={16}
                  className="absolute right-0 top-3 hidden text-slate-700 sm:block"
                />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Workspace notice */}
      <section className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 sm:p-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400/10 bg-emerald-400/[0.06]">
          <ShieldCheck size={18} className="text-emerald-400" />
        </div>

        <div>
          <p className="text-sm font-medium text-slate-200">
            Your support workspace
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            This workspace currently uses a browser-generated visitor ID.
            Sign-in, verified customer identity, and secure private history
            are not implemented yet. Do not treat this temporary ID as an
            authentication or security mechanism.
          </p>
        </div>
      </section>
    </main>
  );
}