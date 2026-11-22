import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelectionProvider } from "@/components/selection";
import { Page, Section } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventDetails } from "@/lib/derive";
import { eventAccounts } from "@/lib/qualify";
import EventHeader from "../event-header";
import { AccountRows, ContactsTable, foundFor } from "./account-rows";
import { AddCandidatesBar } from "./controls";
import Filters from "./filters";

type Props = PageProps<"/events/[eventId]/contacts">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Contacts · ${event.short_name}` };
}

export default function ContactsPage({ params, searchParams }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Contacts params={params} searchParams={searchParams} /></Suspense>;
}

// Where candidates are picked: every contact at the accounts that fit the brief, grouped under a quiet account line,
// with how they qualify and how warm they already are. Tick them and Add Candidates, or find more on Sumble.
// Filters (?ae= an AE's id, or "none" for accounts with no AE, which BDRs work; ?engagement=; ?qualified=1) narrow the
// contacts; accounts with none left drop out.
async function Contacts({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { eventId } = await params;
  const q = await searchParams;
  const s = await loadSnapshot();
  const event = eventDetails(s, eventId);
  const brief = event && s.events.find((b) => b.campaign_id === event.campaign_id);
  if (!event || !brief) notFound();
  const basePath = `/events/${event.slug}`;
  const aes = s.users.filter((u) => u.title === "Account Executive");
  const ae = q.ae === "none" ? "none" : aes.find((u) => u.id === q.ae)?.id;
  const warmth = q.engagement === "none" || q.engagement === "engaged" ? q.engagement : null;
  const qualifiedOnly = q.qualified === "1";
  const filtered = !!(ae || warmth || qualifiedOnly);

  const { fits, excluded } = eventAccounts(s, brief);
  const groups = fits
    .filter((p) => !ae || (p.account.owner_id ?? "none") === ae)
    .map((p) => ({
      ...p,
      shown: p.executives.filter(
        (e) => (!qualifiedOnly || e.status === "Qualified") && (!warmth || (warmth === "none") === (e.engagement[0].color === "green"))
      ),
    }))
    .filter((p) => p.shown.length || !filtered);
  const selected = fits.reduce((n, p) => n + p.executives.filter((e) => e.selected).length, 0);

  return (
    <>
      <EventHeader event={event} page="Contacts" />
      <Page>
        <SelectionProvider>
          <Section
            title="Contacts"
            description={
              <>
                Executives at the {fits.length} accounts that fit the <Link href={`${basePath}/brief`} className="text-blue-900 hover:underline">brief</Link>. Tick the executives to invite and click Add Candidates; marketing then approves them on{" "}
                <Link href={`${basePath}/invites`} className="text-blue-900 hover:underline">Invites</Link> ({selected} so far).
              </>
            }
          >
            <div className="mb-4">
              <Filters aes={aes.map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))} />
            </div>

            {groups.length ? (
              <ContactsTable>
                {groups.map((p) => (
                  <AccountRows key={p.account.id} plan={p} executives={p.shown} found={filtered ? [] : foundFor(s, p, event.campaign_id)} campaignId={event.campaign_id} accountLine />
                ))}
              </ContactsTable>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">
                No executives match these filters. <Link href={`${basePath}/contacts`} className="text-blue-900 hover:underline">Clear filters</Link>
              </p>
            )}
            <AddCandidatesBar campaignId={event.campaign_id} />

            {excluded.length > 0 && (
              <details className="mt-4 rounded-xl p-4 shadow-border">
                <summary className="cursor-pointer text-label-13 font-medium">{excluded.length} accounts outside the brief</summary>
                <ul className="mt-3 space-y-1.5">
                  {excluded.map((p) => (
                    <li key={p.account.id} className="flex justify-between gap-4 text-label-13">
                      <span>{p.account.name}</span>
                      <span className="text-gray-900">{p.excluded}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </Section>
        </SelectionProvider>
      </Page>
    </>
  );
}
