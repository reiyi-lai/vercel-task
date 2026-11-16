import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SelectCheckbox, SelectionProvider } from "@/components/selection";
import { Check, Page, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventDetails, vercelUsage } from "@/lib/derive";
import { eventAccounts } from "@/lib/qualify";
import EventHeader from "../event-header";
import AccountRow, { AddCandidatesBar } from "./account-row";

type Props = PageProps<"/events/[eventId]/accounts">;

const statusColor = { Qualified: "green", Review: "amber", Excluded: "red" } as const;
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Accounts · ${event.short_name}` };
}

export default function AccountsPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Accounts params={params} /></Suspense>;
}

async function Accounts({ params }: Pick<Props, "params">) {
  const { eventId } = await params;
  const s = await loadSnapshot();
  const event = eventDetails(s, eventId);
  const brief = event && s.events.find((b) => b.campaign_id === event.campaign_id);
  if (!event || !brief) notFound();
  const basePath = `/events/${event.slug}`;
  const { fits, excluded } = eventAccounts(s, brief);
  const selected = fits.reduce((n, p) => n + p.executives.filter((e) => e.selected).length, 0);

  return (
    <>
      <EventHeader event={event} page="Accounts" />
      <Page>
        <SelectionProvider>
        <Section
          title="Accounts"
          description={<>{fits.length} accounts fit the brief · {selected} {selected === 1 ? "executive" : "executives"} selected to invite. <Link href={`${basePath}/brief`} className="text-blue-900 hover:underline">Edit the brief</Link> to change who fits.</>}
        >
          <div className="material-base overflow-x-auto">
            {/* Fixed column widths, so opening an account doesn't shift them. */}
            <table className="w-full min-w-[880px] table-fixed text-left">
              <colgroup>
                {/* Account is sized to its longest names, so the chevrons at its right edge sit close beside them. */}
                <col className="w-56" />
                <col className="w-[40%]" />
                <col className="w-[23%]" />
                <col />
              </colgroup>
              <thead className="border-b border-gray-alpha-400 text-label-12 text-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Vercel Pro Usage</th>
                  <th className="px-4 py-3 font-medium">Executives</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Plan</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-alpha-400">
                {fits.map((p) => {
                  const picked = p.executives.filter((e) => e.selected).length;
                  const usage = vercelUsage(s, p.account.id);
                  return (
                    <AccountRow
                      key={p.account.id}
                      name={p.account.name}
                      detail={[p.account.icp_tier, p.account.vertical].filter(Boolean).join(" · ")}
                      cells={<>
                        <td className="px-4 py-3.5">
                          {usage.teams.length ? (
                            <Status color="green">
                              {usage.teams.length} Pro {usage.teams.length === 1 ? "team" : "teams"} · {usage.activeUsers} active users · {usd.format(usage.monthlySpend)}/mo
                            </Status>
                          ) : (
                            <Status color="gray">No Pro teams</Status>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-label-13">{p.executives.filter((e) => e.status !== "Excluded").length} to review · {picked} selected</td>
                        <td className="px-4 py-3.5 text-right">
                          <Link href={`${basePath}/accounts/${p.account.id}`} className="whitespace-nowrap text-label-13 font-medium text-blue-900 hover:underline">Open Plan →</Link>
                        </td>
                      </>}
                    >
                      {/* Executives sit in a darker band under their account, indented, one quiet row each: a checkbox to
                          add them, or a tick once they're a candidate. */}
                      {p.executives.length === 0 ? (
                        <tr className="bg-background-200">
                          <td colSpan={4} className="py-3 pr-4 pl-11 text-label-13 text-gray-900">
                            No executives in the CRM yet. <Link href={`${basePath}/accounts/${p.account.id}`} className="text-blue-900 hover:underline">Open the plan</Link> to find some.
                          </td>
                        </tr>
                      ) : (
                        p.executives.map((e, i) => {
                          const name = `${e.contact.first_name} ${e.contact.last_name}`;
                          const last = i === p.executives.length - 1;
                          return (
                            <tr key={e.contact.id} className={`bg-background-200 text-label-13 ${last ? "" : "border-b-0"} ${e.status === "Excluded" ? "text-gray-900" : ""}`}>
                              <td className={`px-4 ${i === 0 ? "pt-3" : "pt-1.5"} ${last ? "pb-3" : "pb-1.5"}`}>
                                <div className="flex items-center gap-3">
                                  <span className="flex w-4 shrink-0 justify-center">
                                    {!e.selected && e.status !== "Excluded" && <SelectCheckbox id={e.contact.id} name={name} />}
                                  </span>
                                  <span className="min-w-0 truncate text-label-14 font-medium">{name}</span>
                                  {e.selected && (
                                    <span className="flex shrink-0 items-center gap-1 text-label-12 text-gray-900"><Check className="text-green-900" />Added</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 text-gray-900">{e.contact.title}</td>
                              <td className="px-4" colSpan={2}>
                                <Status color={statusColor[e.status]}>{e.status}{e.labels[0] && <span className="text-gray-900"> · {e.labels[0].text}</span>}</Status>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </AccountRow>
                  );
                })}
              </tbody>
            </table>
          </div>
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
