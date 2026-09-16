import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import "./globals.css";

const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-sans-family",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Asteria Grand Hotel · Front desk",
  description:
    "Talk with Leela at the Asteria desk about rooms, amenities, hotel policies, and mock availability.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="asteria" className={`${figtree.variable} h-full antialiased`}>
      <link rel="preload" as="image" href="/hotel/reception-desk.png" />
      <link rel="preload" as="image" href="/hotel/leela.png" />
      <body className="min-h-full bg-white font-sans text-[var(--color-ink)]">
        {children}
      </body>
    </html>
  );
}
