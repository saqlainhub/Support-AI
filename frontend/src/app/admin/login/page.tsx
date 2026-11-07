
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { clear } from "console";

interface AdminUser {
  id: number;
  username: string;
  role: "admin";
}

export default function AdminLoginPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await apiRequest<AdminUser>("/admin/auth/login", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      // The backend sets the HTTP-only session cookie.
      router.replace("/admin");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#07111F] px-4 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101D2D] p-7 shadow-2xl sm:p-9">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-[#E6A000]">
            SupportAI
          </p>

          <h1 className="text-3xl font-bold tracking-tight">
            Admin login
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            Sign in with your administrator credentials to access the
            administration panel.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="username"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Username
            </label>

            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              maxLength={100}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Enter admin username"
              className="w-full rounded-lg border border-white/10 bg-[#07111F] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#E6A000] focus:ring-1 focus:ring-[#E6A000]"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-200"
            >
              Password
            </label>

            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter admin password"
              className="w-full rounded-lg border border-white/10 bg-[#07111F] px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#E6A000] focus:ring-1 focus:ring-[#E6A000]"
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            className="w-full rounded-lg bg-[#E6A000] px-4 py-3 font-semibold text-[#07111F] transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Authorized administrators only.
        </p>
      </section>
    </main>
  );
}
