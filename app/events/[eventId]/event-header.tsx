import { PageHeader } from "@/components/ui";
import type { eventDetails } from "@/lib/derive";

type Event = NonNullable<ReturnType<typeof eventDetails>>;

// The event's header band. Its pages (Overview, Brief, Accounts, Candidates) are in the sidebar.
export default function EventHeader({ event, page }: { event: Event; page: "Overview" | "Brief" | "Accounts" | "Candidates" }) {
  return (
    <PageHeader crumbs={[{ label: event.short_name, href: `/events/${event.slug}` }, { label: page }]}>
      <h1 className="text-heading-32">{event.name}</h1>
      <p className="mt-1 text-label-13 text-gray-900">
        {[event.date, event.location].filter(Boolean).join(" · ")}
      </p>
    </PageHeader>
  );
}
