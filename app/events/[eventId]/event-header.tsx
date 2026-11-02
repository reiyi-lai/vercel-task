import { PageHeader, TabLinks } from "@/components/ui";
import type { Snapshot } from "@/lib/data";
import type { eventOverview } from "@/lib/derive";

type Event = NonNullable<ReturnType<typeof eventOverview>>["event"];

// The Candidates tab's count: executives selected on account plans plus candidates imported by CSV.
export const candidateCount = (s: Snapshot, campaignId: string) =>
  s.invitation_selections.filter((x) => x.campaign_id === campaignId).length + s.candidates.filter((c) => c.campaign_id === campaignId).length;

// The event's header band and its Brief / Accounts / Overview / Candidates tabs.
export default function EventHeader({ event, active, candidates }: { event: Event; active: "brief" | "accounts" | "overview" | "candidates"; candidates: number }) {
  const basePath = `/events/${event.slug}`;
  return (
    <PageHeader
      crumbs={[{ label: "All Events" }, { label: event.program ?? event.short_name }]}
      tabs={
        <TabLinks
          items={[
            { label: "Brief", href: `${basePath}/brief`, active: active === "brief" },
            { label: "Accounts", href: `${basePath}/accounts`, active: active === "accounts" },
            { label: "Overview", href: basePath, active: active === "overview" },
            { label: <>Candidates <span className="text-label-12 text-gray-900">{candidates}</span></>, href: `${basePath}/candidates`, active: active === "candidates" },
          ]}
        />
      }
    >
      <h1 className="text-heading-32">{event.name}</h1>
      <p className="mt-1 text-label-13 text-gray-900">
        {[
          event.date,
          event.seats && `${event.seats}\u00a0seats`,
          event.daysOut >= 0 ? `${event.daysOut}\u00a0days out` : "Past event",
          event.hosts && `Hosts: ${event.hosts}`,
        ].filter(Boolean).join(" · ")}
      </p>
    </PageHeader>
  );
}
