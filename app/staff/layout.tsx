export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return <div className="min-h-[100dvh] bg-[var(--color-surface-soft)]">{children}</div>;
}
