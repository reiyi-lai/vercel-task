import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Meter, PageHeader, Page, Status } from "@/components/ui";
import { outreachVolume } from "@/lib/brief";
import { loadSnapshot } from "@/lib/data";
import { eventDetails, eventsByDate } from "@/lib/derive";
import { eventProgress } from "@/lib/sequence";

export default function Home() {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Events /></Suspense>;
}

// Every event at a glance, for the CMO and the head of experiential: when and where, and how close each is to its
// guest target, with anything that needs attention.
async function Events() {
  await connection(); // overdue steps and days out depend on today's date
  const s = await loadSnapshot();
  const events = eventsByDate(s).map(({ e, days }) => {
    const p = eventProgress(s, e);
    return { e, event: eventDetails(s, e.slug)!, p, volume: outreachVolume(e, p.confirmedInSalesforce), days };
  });

  return (
    <>
      <PageHeader>
        <h1 className="text-heading-32">All Events</h1>
        <p className="mt-1 text-copy-14 text-gray-900">Each event’s guests against its target, and what needs attention.</p>
      </PageHeader>
      <Page>
        <ul className="space-y-4">
          {events.map(({ e, event, p, volume, days }) => (
            <li key={e.slug}>
              <Link href={`/events/${e.slug}`} className={`material-base grid gap-6 p-5 transition-colors hover:bg-gray-100 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] ${days < 0 ? "opacity-60" : ""}`}>
                <div className="min-w-0 space-y-1">
                  <p className="text-label-12 text-gray-900">{days > 0 ? `In ${days} ${days === 1 ? "day" : "days"}` : days === 0 ? "Today" : "Past"}</p>
                  <h2 className="text-heading-20">{event.name}</h2>
                  <p className="text-label-13 text-gray-900">{[event.date, e.location, e.format, e.seats && `${e.seats} seats`].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="space-y-3">
                  <div className="grid gap-4 sm:grid-cols-3">
                    {[
                      { label: "Guests Accepted", n: p.accepted, of: e.target_guests, fill: "bg-green-700" },
                      { label: "Invites Sent", n: p.invited, of: volume.invites, fill: "bg-blue-700" },
                      { label: "Shortlisted", n: p.shortlisted, of: volume.shortlist, fill: "bg-gray-1000" },
                    ].map((x) => (
                      <div key={x.label} className="space-y-1.5">
                        <p className="text-label-12 text-gray-900">{x.label}</p>
                        <p className="text-label-14 font-medium">{x.n}<span className="text-gray-900"> / {x.of}</span></p>
                        <Meter label={`${event.short_name}: ${x.label}`} n={x.n} of={x.of} fill={x.fill} />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1">
                    <Status color={p.overdue ? "red" : "gray"}>{p.overdue} overdue {p.overdue === 1 ? "step" : "steps"}</Status>
                    <Status color="amber">{p.awaiting} awaiting reply</Status>
                    <Status color="blue">{p.replied} replied</Status>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Page>
    </>
  );
}
