import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventDetails } from "@/lib/derive";
import EventHeader, { candidateCount } from "../event-header";
import BriefForm from "./brief-form";

type Props = PageProps<"/events/[eventId]/brief">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Brief · ${event.short_name}` };
}

export default function BriefPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Brief params={params} /></Suspense>;
}

async function Brief({ params }: Pick<Props, "params">) {
  const { eventId } = await params;
  const s = await loadSnapshot();
  const event = eventDetails(s, eventId);
  const brief = event && s.events.find((b) => b.campaign_id === event.campaign_id);
  if (!event || !brief) notFound();
  const campaign = s.campaigns.find((c) => c.id === event.campaign_id)!;
  const confirmed = s.campaign_members.filter((m) => m.campaign_id === event.campaign_id && m.invite_status === "Confirmed").length;

  return (
    <>
      <EventHeader event={event} active="brief" candidates={candidateCount(s, event.campaign_id)} />
      <Page>
        <BriefForm
          key={event.slug}
          brief={brief}
          event={{ slug: event.slug, startDate: campaign.start_date!, endDate: campaign.end_date, seats: event.seats }}
          events={s.events.map((e) => ({ slug: e.slug, name: s.campaigns.find((c) => c.id === e.campaign_id)!.name }))}
          confirmed={confirmed}
        />
      </Page>
    </>
  );
}
