import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge } from "@/components/ui";
import SidebarNav from "@/components/sidebar";
import { loadSnapshot } from "@/lib/data";
import { eventsByDate } from "@/lib/derive";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Seatbook", template: "%s · Seatbook" },
  description: "Find the right executives for each Vercel event, and run their outreach.",
};

export const viewport: Viewport = { themeColor: "#000000" };

const Logo = () => (
  <Link href="/" className="flex items-center gap-2 text-label-14 font-semibold" translate="no">
    <span aria-hidden className="grid size-4 grid-cols-2 gap-px">
      {[0, 1, 2, 3].map((i) => <span key={i} className="rounded-[1px] bg-gray-1000" />)}
    </span>
    Seatbook
  </Link>
);

// The events for the sidebar, in All Events' order, with each one's candidate count.
async function Nav() {
  await connection(); // the order depends on today's date
  const s = await loadSnapshot();
  const events = eventsByDate(s).map(({ e }) => ({ slug: e.slug, name: e.short_name, candidates: s.candidates.filter((c) => c.campaign_id === e.campaign_id).length }));
  return <SidebarNav events={events} />;
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen font-sans lg:flex">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-md focus:bg-background-100 focus:px-3 focus:py-1.5 focus:text-label-14">
          Skip to Content
        </a>
        {/* Wide screens: a fixed sidebar. Narrow ones: a top bar with the same navigation in a menu. */}
        <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r border-gray-alpha-400 bg-background-100 px-3 py-5 lg:flex">
          <div className="px-2.5"><Logo /></div>
          <Suspense><Nav /></Suspense>
          <div className="mt-auto px-2.5"><Badge variant="amber">Sample Data</Badge></div>
        </aside>
        <details className="border-b border-gray-alpha-400 bg-background-100 px-4 lg:hidden">
          <summary className="flex h-14 cursor-pointer list-none items-center justify-between">
            <Logo />
            <span className="text-label-14 text-gray-900">Menu</span>
          </summary>
          <div className="pb-4"><Suspense><Nav /></Suspense></div>
        </details>
        <main id="main" className="min-w-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
