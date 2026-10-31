import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ParamSwitch from "@/components/param-switch";
import { Avatar, Badge, Button, Page, PageHeader, Section, TabLinks, Tags } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventOverview } from "@/lib/derive";
import Pipeline, { slugify } from "./pipeline";

type Props = PageProps<"/events/[eventId]">;

const seatBadge = { Confirmed: "inverted", Pending: "amber", Open: "outline" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  return { title: (await loadSnapshot()).events.find((e) => e.slug === eventId)?.short_name };
}

export default function EventPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><EventOverview params={params} /></Suspense>;
}

async function EventOverview({ params }: Pick<Props, "params">) {
  const { eventId } = await params;
  const o = eventOverview(await loadSnapshot(), eventId);
  if (!o) notFound();
  const { event, seats, pipeline } = o;
  const basePath = `/events/${event.slug}`;
  const aes = [...new Set(pipeline.flatMap((col) => col.cards.map((c) => c.ae)))].sort();

  return (
    <>
      <PageHeader
        crumbs={[{ label: "All Events" }, { label: event.program ?? event.short_name }]}
        tabs={<TabLinks items={[{ label: "Overview", href: basePath, active: true }, { label: <>Candidates <span className="text-label-12 text-gray-900">{o.candidates}</span></> }]} />}
      >
        <h1 className="text-heading-32">{event.name}</h1>
        <p className="mt-1 text-label-13 text-gray-900">
          {event.date} · {seats.length}&nbsp;seats · {event.daysOut}&nbsp;days out · Hosts: {event.hosts}
        </p>
      </PageHeader>

      <Page>
        <div className="material-medium p-6">
          <Section title="Seats" aside={<Button>Swap Seats…</Button>}>
            <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {seats.map((seat) => (
                <div key={seat.n} className={`min-w-0 space-y-3 p-4 ${seat.status === "Open" ? "rounded-xl border border-dashed border-gray-alpha-500 bg-background-200" : "material-small"}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-label-12 text-gray-900">Seat {seat.n}</span>
                    <Badge variant={seatBadge[seat.status]}>{seat.status}</Badge>
                  </div>
                  {seat.status === "Open" ? (
                    <div className="flex items-center gap-3">
                      <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gray-alpha-500 text-gray-900">+</span>
                      <p className="text-heading-16">Open Seat</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        <Avatar name={seat.name} size="lg" tone={seat.status === "Confirmed" ? "dark" : "blue"} />
                        <div className="min-w-0">
                          <p className="break-words text-heading-16">{seat.name}</p>
                          <p className="text-copy-13 text-gray-900">{seat.title}</p>
                          <p className="text-copy-13 text-gray-900">{seat.company}</p>
                        </div>
                      </div>
                      <Tags vertical={seat.vertical} horizontals={seat.horizontals} />
                    </>
                  )}
                </div>
              ))}
            </div>
          </Section>
        </div>

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
