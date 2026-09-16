export default function StaffLayout({ children }: LayoutProps<"/staff">) {
  return <div className="h-[100dvh] overflow-hidden bg-[var(--color-surface-soft)]">{children}</div>;
}
