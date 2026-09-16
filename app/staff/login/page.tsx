import { StaffLoginForm } from "@/components/staff/StaffLoginForm";

export default function StaffLoginPage() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6">
      <p className="text-[13px] font-semibold tracking-tight text-[var(--color-primary)]">asteria</p>
      <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-[var(--color-ink)]">
        Staff desk
      </h1>
      <p className="mt-2 text-[15px] leading-6 text-[var(--color-muted)]">
        Sign in to read guest conversations, take over live chats, and update room inventory.
      </p>
      <div className="mt-8">
        <StaffLoginForm />
      </div>
    </main>
  );
}
