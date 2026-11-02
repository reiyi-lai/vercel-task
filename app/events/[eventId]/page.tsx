import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Page, Section, Status } from "@/components/ui";
import { outreachVolume } from "@/lib/brief";
import { loadSnapshot } from "@/lib/data";
import { eventOverview } from "@/lib/derive";
import EventHeader, { candidateCount } from "./event-header";
import Pipeline from "./pipeline";
import { eventProgress } from "@/lib/sequence";

type Props = PageProps<"/events/[eventId]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  return { title: (await loadSnapshot()).events.find((e) => e.slug === eventId)?.short_name };
}

export default function EventPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><EventOverview params={params} /></Suspense>;
}

async function EventOverview({ params }: Pick<Props, "params">) {
  const { eventId } = await params;
  await connection(); // overdue steps depend on today's date, so render at request time
  const s = await loadSnapshot();
  const o = eventOverview(s, eventId);
  const brief = o && s.event_briefs.find((b) => b.campaign_id === o.event.campaign_id);
  if (!o || !brief) notFound();
  const { event, pipeline } = o;
  const p = eventProgress(s, brief);
  const volume = outreachVolume(brief, p.confirmedInSalesforce);
  // The funnel left to right, each against the brief's attendance plan (targets work back from the guest target).
  const bars = [
    { label: "Executives Shortlisted", n: p.shortlisted, of: volume.shortlist, note: `Target at ${brief.approval_rate}% approval`, fill: "bg-gray-1000" },
    { label: "Invites Sent", n: p.invited, of: volume.invites, note: `Target at ${brief.acceptance_rate}% acceptance`, fill: "bg-blue-700" },
    { label: "Guests Accepted", n: p.accepted, of: brief.target_guests, note: `${p.confirmedInSalesforce} confirmed in Salesforce`, fill: "bg-green-700" },
  ];
  const basePath = `/events/${event.slug}`;

  return (
    <>
      <EventHeader event={event} active="overview" candidates={candidateCount(s, event.campaign_id)} />

      <Page>
        <Section
          title="Progress"
          description={<>Against the targets in the <Link href={`${basePath}/brief`} className="text-blue-900 hover:underline">brief</Link>.</>}
        >
          <div className="grid gap-3 sm:grid-cols-3">
            {bars.map((x) => (
              <div key={x.label} className="material-base space-y-3 p-5">
                <p className="text-label-13 text-gray-900">{x.label}</p>
                <p className="text-heading-32">
                  {x.n}
                  <span className="text-heading-20 text-gray-900"> / {x.of}</span>
                </p>
                <div role="progressbar" aria-label={x.label} aria-valuenow={x.n} aria-valuemin={0} aria-valuemax={x.of} className="h-2 overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full rounded-full ${x.fill}`} style={{ width: `${Math.min(100, x.of ? (x.n / x.of) * 100 : 100)}%` }} />
                </div>
                <p className="text-label-12 text-gray-900">{x.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-label-13">
            <Status color={p.overdue ? "red" : "gray"}>{p.overdue} overdue {p.overdue === 1 ? "step" : "steps"}</Status>
            <Status color="amber">{p.awaiting} awaiting reply</Status>
            <Status color="blue">{p.replied} replied</Status>
            <Status color="red">{p.declined} declined</Status>
          </div>
        </Section>

        <Pipeline columns={pipeline} bdrLed={brief.outreach_lead === "bdr"} />
      </Page>
    </>
  );
}
