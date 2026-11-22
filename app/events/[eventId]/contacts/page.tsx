import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelectCheckbox, SelectionProvider } from "@/components/selection";
import { Badge, Check, Page, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventDetails, vercelUsage } from "@/lib/derive";
import { eventAccounts } from "@/lib/qualify";
import { NEW_IN_ROLE_SINCE } from "@/lib/rules";
import { profileKey } from "@/lib/sumble";
import EventHeader from "../event-header";
import { AddCandidatesBar, FindExecutives, FoundActions } from "./controls";
import Filters from "./filters";

type Props = PageProps<"/events/[eventId]/contacts">;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const month = (ym: string) => new Date(`${ym}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

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
// Filters (?ae=, ?engagement=, ?qualified=1) narrow the contacts; accounts with none left drop out.
async function Contacts({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { eventId } = await params;
  const q = await searchParams;
  const s = await loadSnapshot();
  const event = eventDetails(s, eventId);
  const brief = event && s.events.find((b) => b.campaign_id === event.campaign_id);
  if (!event || !brief) notFound();
  const basePath = `/events/${event.slug}`;
  const aes = s.users.filter((u) => u.title === "Account Executive");
  const ae = aes.find((u) => u.id === q.ae)?.id;
  const warmth = q.engagement === "none" || q.engagement === "engaged" ? q.engagement : null;
  const qualifiedOnly = q.qualified === "1";
  const filtered = !!(ae || warmth || qualifiedOnly);

  const { fits, excluded } = eventAccounts(s, brief);
  const inCrm = new Set(s.contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
  const groups = fits
    .filter((p) => !ae || p.account.owner_id === ae)
    .map((p) => ({
      ...p,
      shown: p.executives.filter(
        (e) => (!qualifiedOnly || e.status === "Qualified") && (!warmth || (warmth === "none") === (e.engagement[0].color === "green"))
      ),
      found: s.found_executives.filter((x) => x.account_id === p.account.id && x.campaign_id === event.campaign_id),
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
              <div className="material-base overflow-x-auto">
                <table className="w-full min-w-[880px] table-fixed text-left">
                  {/* Executive takes what's left; the actions column is fixed wide enough for its buttons. */}
                  <colgroup>
                    <col />
                    <col className="w-[22%]" />
                    <col className="w-[26%]" />
                    <col className="w-52" />
                  </colgroup>
                  <thead className="border-b border-gray-alpha-400 text-label-12 text-gray-900">
                    <tr>
                      <th className="px-4 py-3 font-medium">Executive</th>
                      <th className="px-4 py-3 font-medium">Fit for This Event</th>
                      <th className="px-4 py-3 font-medium">Prior Engagement</th>
                      <th className="px-4 py-3 font-medium"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  {groups.map((p) => {
                    const usage = vercelUsage(s, p.account.id);
                    const live = !p.account.website?.endsWith(".example");
                    const found = p.found.filter((x) => !inCrm.has(profileKey(x.linkedin_url)));
                    return (
                      <tbody key={p.account.id} id={p.account.id} className="scroll-mt-6 border-t border-gray-alpha-400 first-of-type:border-t-0">
                        {/* The account line only groups its contacts: small, quiet, with the context that bears on who to pick. */}
                        <tr>
                          <td colSpan={3} className="px-4 pt-4 pb-1 text-label-13">
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-medium">{p.account.name}</span>
                              <span className="text-gray-900">{[p.account.icp_tier, p.account.vertical].filter(Boolean).join(" · ")}</span>
                              {/* Vercel usage as one chip: plan, teams, spend, and who pays for the biggest team. */}
                              {usage.teams.length ? (
                                <Badge variant="outline">
                                  ▲ Vercel {[...new Set(usage.teams.map((x) => x.plan))].join("/")} · {usage.teams.length} {usage.teams.length === 1 ? "team" : "teams"} · {usd.format(usage.monthlySpend)}/mo
                                  {(usage.teams[0].key_contact_name ?? usage.teams[0].key_contact_title) && ` · Owner: ${usage.teams[0].key_contact_name ?? usage.teams[0].key_contact_title}`}
                                </Badge>
                              ) : (
                                <span className="text-gray-900">No Vercel teams</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 pt-4 pb-1 text-right">
                            {live && <FindExecutives accountId={p.account.id} campaignId={event.campaign_id} searched={p.found.length > 0} />}
                          </td>
                        </tr>
                        {!p.executives.length && (
                          <tr>
                            <td colSpan={4} className="px-4 py-3 text-label-13 text-gray-900">
                              No executives in the CRM yet.{live ? " Find More Executives searches Sumble for this event’s target personas." : ""}
                            </td>
                          </tr>
                        )}
                        {p.shown.map((e) => {
                          const name = `${e.contact.first_name} ${e.contact.last_name}`;
                          return (
                            <tr key={e.contact.id} className={`align-top text-label-13 ${e.status === "Excluded" ? "text-gray-900" : ""}`}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-start gap-3">
                                  <span className="flex h-5 w-4 shrink-0 items-center justify-center">
                                    {e.selected ? <Check className="text-green-900" /> : e.status !== "Excluded" && <SelectCheckbox id={e.contact.id} name={name} />}
                                  </span>
                                  <div className="min-w-0">
                                    {e.contact.linkedin_url && !e.contact.linkedin_url.includes("linkedin.example") ? (
                                      <a href={e.contact.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-label-14 font-medium hover:underline">{name} ↗</a>
                                    ) : (
                                      <p className="truncate text-label-14 font-medium">{name}</p>
                                    )}
                                    <p className="text-label-12 text-gray-900">{e.contact.title}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                {/* One dot per check (rank, location, …); an excluded contact shows only why. */}
                                <ul className="space-y-1">
                                  {e.labels.map((l) => <li key={l.text}><Status color={l.color}><span className="text-label-13">{l.text}</span></Status></li>)}
                                </ul>
                              </td>
                              <td className="px-4 py-2.5">
                                <ul className="space-y-1.5">
                                  {e.engagement.map((l) => (
                                    <li key={l.text}>
                                      <Status color={l.color}><span className="text-label-13">{l.text}</span></Status>
                                      {l.detail && <p className="pl-3.5 text-label-12 text-gray-900">{l.detail}</p>}
                                    </li>
                                  ))}
                                </ul>
                              </td>
                              <td className="px-4 py-2.5 text-label-12 text-gray-900">{e.selected && "Candidate"}</td>
                            </tr>
                          );
                        })}
                        {!filtered && found.map((x) => (
                          <tr key={x.linkedin_url} className="align-top text-label-13">
                            <td className="px-4 py-2.5">
                              <div className="flex items-start gap-3">
                                <span className="w-4 shrink-0" />
                                <div className="min-w-0">
                                  <a href={x.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-label-14 font-medium hover:underline">{x.name} ↗</a>
                                  <p className="text-label-12 text-gray-900">{[x.title, x.location].filter(Boolean).join(" · ")}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              {x.persona ? (
                                <Status color="green"><span className="text-label-13">Matches {x.persona}</span></Status>
                              ) : (
                                <Status color="gray"><span className="text-label-13">Not a target persona</span></Status>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {x.started && x.started >= NEW_IN_ROLE_SINCE && <Status color="blue"><span className="text-label-12">New in role · {month(x.started)}</span></Status>}
                            </td>
                            <td className="px-4 py-2.5">
                              <FoundActions accountId={p.account.id} campaignId={event.campaign_id} linkedinUrl={x.linkedin_url} />
                            </td>
                          </tr>
                        ))}
                        <tr aria-hidden><td colSpan={4} className="h-2" /></tr>
                      </tbody>
                    );
                  })}
                </table>
              </div>
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
