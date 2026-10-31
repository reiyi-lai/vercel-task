import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { Badge } from "@/components/ui";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Seatbook", template: "%s · Seatbook" },
  description: "Curate who gets the 10 seats, and the warmest way to invite them.",
};

export const viewport: Viewport = { themeColor: "#000000" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen font-sans">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-3 focus:z-10 focus:rounded-md focus:bg-background-100 focus:px-3 focus:py-1.5 focus:text-label-14">
          Skip to Content
        </a>
        <header className="bg-background-100">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-3 px-4 text-label-14 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold" translate="no">
              <span aria-hidden className="grid size-4 grid-cols-2 gap-px">
                {[0, 1, 2, 3].map((i) => <span key={i} className="rounded-[1px] bg-gray-1000" />)}
              </span>
              Seatbook
            </Link>
            <span aria-hidden className="text-gray-500">/</span>
            <span className="text-gray-900">All Events</span>
            <div className="ml-auto flex items-center gap-3">
              <Badge variant="amber">Sample Data</Badge>
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
