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
import { AccountRows, ContactsTable, foundFor, isLive } from "./account-rows";
import { AccountBrowser, AccountList, AccountPanel } from "./browser";
import { AddCandidatesBar, FindExecutives } from "./controls";
import Filters from "./filters";

type Props = PageProps<"/events/[eventId]/contacts">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Accounts · ${event.short_name}` };
}

export default function AccountsPage({ params, searchParams }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Contacts params={params} searchParams={searchParams} /></Suspense>;
}

// Where candidates are picked, an account at a time: the accounts that fit the brief down the left, each showing whether
// it has candidates yet, and the chosen one's executives on the right, with how they qualify and how warm they already
// are. Tick them and Add Candidates (ticks carry across accounts), or find more on Sumble.
// ?engagement= narrows the executives here; accounts with none left drop out. The rest only narrow the account list, so
// apply in the browser (see AccountBrowser): ?ae= (an AE's id, or "none" for accounts with no AE, which BDRs work),
// ?accounts= and ?selected=.
async function Contacts({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { eventId } = await params;
  const q = await searchParams;
  const s = await loadSnapshot();
  const event = eventDetails(s, eventId);
  const brief = event && s.events.find((b) => b.campaign_id === event.campaign_id);
  if (!event || !brief) notFound();
  const basePath = `/events/${event.slug}`;
  const aes = s.users.filter((u) => u.title === "Account Executive");
  const warmth = q.engagement === "none" || q.engagement === "engaged" ? q.engagement : null;

  // The engagement filter narrows the CRM executives only: Sumble results aren't contacts yet, so they always show, and
  // an account stays listed while it has either.
  const { fits, excluded } = eventAccounts(s, brief);
  const groups = fits
    .map((p) => ({
      ...p,
      shown: p.executives.filter((e) => !warmth || (warmth === "none") === (e.engagement[0].color === "green")),
      found: foundFor(s, p, event.campaign_id),
    }))
    .filter((p) => !warmth || p.shown.length || p.found.length);
  const selected = fits.reduce((n, p) => n + p.executives.filter((e) => e.selected).length, 0);

  return (
    <>
      <EventHeader event={event} page="Accounts" />
      <Page>
        <SelectionProvider>
          <Section
            title="Accounts"
            description={
              <>
                The {fits.length} accounts that fit the <Link href={`${basePath}/brief`} className="text-blue-900 hover:underline">brief</Link>. Pick an account, tick the executives to invite and click Add Candidates; marketing then approves them on{" "}
                <Link href={`${basePath}/invites`} className="text-blue-900 hover:underline">Invites</Link> ({selected} so far).
              </>
            }
          >
            <div className="mb-4">
              <Filters aes={aes.map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }))} accounts={groups.map((p) => ({ id: p.account.id, name: p.account.name }))} />
            </div>

            {groups.length ? (
              <AccountBrowser
                items={groups.map((p) => ({
                  id: p.account.id,
                  name: p.account.name,
                  tier: p.account.icp_tier,
                  owner: p.account.owner_id ?? "none",
                  qualified: p.executives.filter((e) => e.status === "Qualified").length,
                  selected: p.executives.filter((e) => e.selected).length,
                }))}
              >
                <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                  <AccountList />
                  <div className="min-w-0">
                    {groups.map((p) => {
                      const owner = aes.find((u) => u.id === p.account.owner_id);
                      return (
                        <AccountPanel key={p.account.id} id={p.account.id}>
                          {/* The account's header, one line: who it is, who owns it, and finding more people. (How covered it is
                              shows on its card in the list.) */}
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                              <h3 className="text-heading-20">{p.account.name}</h3>
                              <span className="text-label-13 text-gray-900">
                                {[p.account.icp_tier, p.account.vertical, owner ? `AE ${owner.first_name} ${owner.last_name}` : "No AE (BDR account)"].filter(Boolean).join(" · ")}
                              </span>
                            </div>
                            {isLive(p) && <FindExecutives accountId={p.account.id} campaignId={event.campaign_id} searched={p.found.length > 0} />}
                          </div>
                          <ContactsTable>
                            <AccountRows plan={p} executives={p.shown} found={p.found} campaignId={event.campaign_id} />
                          </ContactsTable>
                        </AccountPanel>
                      );
                    })}
                    <AddCandidatesBar campaignId={event.campaign_id} />
                  </div>
                </div>
              </AccountBrowser>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">
                No executives match these filters. <Link href={`${basePath}/contacts`} className="text-blue-900 hover:underline">Clear filters</Link>
              </p>
            )}

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
