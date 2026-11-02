"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type SidebarEvent = { slug: string; name: string; candidates: number };

const item = (active: boolean) =>
  `flex h-8 items-center justify-between gap-2 rounded-lg px-2.5 text-label-14 ${active ? "bg-gray-100 font-medium text-gray-1000" : "text-gray-900 hover:bg-gray-100 hover:text-gray-1000"}`;

// The app's navigation: the events home, the AE and BDR queue, then each event. An event's name opens its Overview;
// its arrow expands its pages in workflow order. The event you're in starts open.
export default function SidebarNav({ events }: { events: SidebarEvent[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="space-y-6">
      <ul className="space-y-0.5">
        <li><Link href="/" className={item(path === "/")} aria-current={path === "/" ? "page" : undefined}>All Events</Link></li>
        <li><Link href="/outreach" className={item(path === "/outreach")} aria-current={path === "/outreach" ? "page" : undefined}>My Outreach</Link></li>
      </ul>
      <div>
        <p className="px-2.5 pb-1.5 text-label-12 text-gray-900">Events</p>
        <ul className="space-y-0.5">
          {events.map((e) => {
            const base = `/events/${e.slug}`;
            const inside = path === base || path.startsWith(`${base}/`);
            // Keyed on being inside, so navigating into an event opens it; otherwise the user's toggle stands.
            return <EventGroup key={`${e.slug}-${inside}`} event={e} path={path} open={inside} />;
          })}
        </ul>
      </div>
    </nav>
  );
}

function EventGroup({ event, path, open: initial }: { event: SidebarEvent; path: string; open: boolean }) {
  const [open, setOpen] = useState(initial);
  const base = `/events/${event.slug}`;
  const pages = [
    { label: "Brief", href: `${base}/brief`, active: path === `${base}/brief` },
    { label: "Accounts", href: `${base}/accounts`, active: path.startsWith(`${base}/accounts`) },
    { label: "Candidates", href: `${base}/candidates`, active: path.startsWith(`${base}/candidates`), count: event.candidates },
  ];
  return (
    <li>
      <div className={`${item(path === base)} pr-0`}>
        <Link href={base} aria-current={path === base ? "page" : undefined} className="flex h-full min-w-0 flex-1 items-center truncate">{event.name}</Link>
        <button type="button" aria-expanded={open} aria-label={`${open ? "Collapse" : "Expand"} ${event.name}`} onClick={() => setOpen(!open)} className="grid size-8 shrink-0 place-items-center text-label-12">
          <span aria-hidden>{open ? "▾" : "▸"}</span>
        </button>
      </div>
      {open && (
        <ul className="mt-0.5 ml-2.5 space-y-0.5 border-l border-gray-alpha-400 pl-2">
          {pages.map((p) => (
            <li key={p.label}>
              <Link href={p.href} className={item(p.active)} aria-current={p.active ? "page" : undefined}>
                {p.label}
                {p.count !== undefined && <span className="text-label-12 text-gray-900">{p.count}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
