"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

export function StaffLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(null);
        try {
          const response = await fetch("/api/staff/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password, name }),
          });
          const data = (await response.json()) as { message?: string };
          if (!response.ok) {
            setError(data.message || "Could not sign in.");
            return;
          }
          router.push("/staff/desk");
          router.refresh();
        } catch {
          setError("Could not reach the staff desk.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <label htmlFor="staff-name" className="mb-1 block text-[13px] font-medium text-[var(--color-muted)]">
          Your name
        </label>
        <input
          id="staff-name"
          type="text"
          autoComplete="name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Front desk"
          className="h-12 w-full rounded-xl bg-white px-3 text-[16px] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
        />
      </div>
      <div>
        <label htmlFor="staff-password" className="mb-1 block text-[13px] font-medium text-[var(--color-muted)]">
          Password
        </label>
        <input
          id="staff-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-xl bg-white px-3 text-[16px] text-[var(--color-ink)] ring-1 ring-[var(--color-hairline)] outline-none focus:ring-2 focus:ring-[var(--color-ink)]"
        />
      </div>
      {error ? (
        <p className="text-[14px] text-[var(--color-error)]" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={busy || !password} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
