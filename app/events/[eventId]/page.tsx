import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ParamSwitch from "@/components/param-switch";
import { Page } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventOverview } from "@/lib/derive";
import EventHeader, { candidateCount } from "./event-header";
import Pipeline, { slugify } from "./pipeline";
import Seats from "./seats";

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
  const s = await loadSnapshot();
  const o = eventOverview(s, eventId);
  if (!o) notFound();
  const { event, seats, pipeline } = o;
  const basePath = `/events/${event.slug}`;
  const aes = [...new Set(pipeline.flatMap((col) => col.cards.map((c) => c.ae)))].sort();

  return (
    <>
      <EventHeader event={event} active="overview" candidates={candidateCount(s, event.campaign_id)} />

      <Page>
        {seats.length > 0 && (
          <div className="material-medium p-6">
            <Seats initialSeats={seats} initialUnseated={o.unseated} />
          </div>
        )}

        <ParamSwitch
          name="ae"
          views={{
            all: <Pipeline columns={pipeline} aes={aes} basePath={basePath} />,
            ...Object.fromEntries(aes.map((ae) => [slugify(ae), <Pipeline key={ae} columns={pipeline} aes={aes} ae={ae} basePath={basePath} />])),
          }}
        />
      </Page>
    </>
  );
}
