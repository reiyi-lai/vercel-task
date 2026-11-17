import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Page, PageHeader } from "@/components/ui";
import { FORMATS } from "@/lib/brief";
import { loadSnapshot } from "@/lib/data";
import BriefForm from "../[eventId]/brief/brief-form";

export const metadata: Metadata = { title: "New Event" };

type Format = keyof typeof FORMATS;

export default function NewEventPage({ searchParams }: PageProps<"/events/new">) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><NewEvent searchParams={searchParams} /></Suspense>;
}

// A new event: pick its format, which pre-fills the brief from the existing event of that kind, edit, then create.
async function NewEvent({ searchParams }: Pick<PageProps<"/events/new">, "searchParams">) {
  const q = (await searchParams).format;
  const format: Format = typeof q === "string" && q in FORMATS ? (q as Format) : "f1";
  const template = (await loadSnapshot()).events.find((e) => e.slug === FORMATS[format].from)!;

  return (
    <>
      <PageHeader crumbs={[{ label: "All Events", href: "/" }, { label: "New Event" }]}>
        <h1 className="text-heading-32">New Event</h1>
      </PageHeader>
      <Page>
        <section className="space-y-3">
          <h2 className="text-heading-16">Format</h2>
          <ul className="grid gap-3 sm:grid-cols-3">
            {(Object.entries(FORMATS) as [Format, (typeof FORMATS)[Format]][]).map(([key, f]) => (
              <li key={key}>
                <Link
                  href={`?format=${key}`}
                  scroll={false}
                  aria-current={key === format ? "true" : undefined}
                  className={`block h-full rounded-xl p-4 transition-colors ${key === format ? "bg-gray-100 ring-2 ring-gray-1000" : "shadow-border hover:bg-gray-100"}`}
                >
                  <p className="text-label-14 font-medium">{f.label}</p>
                  <p className="mt-1 text-label-12 text-gray-900">{f.detail}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <BriefForm key={format} create brief={{ ...template, select_by: null }} event={{ slug: "", startDate: "", endDate: null, seats: template.seats }} confirmed={0} />
      </Page>
    </>
  );
}
