import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge, Page, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventOverview } from "@/lib/derive";
import { accountPlan, isEnterpriseCustomer } from "@/lib/qualify";
import EventHeader, { candidateCount } from "../event-header";

type Props = PageProps<"/events/[eventId]/accounts">;

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
  const o = eventOverview(s, eventId);
  const brief = o && s.event_briefs.find((b) => b.campaign_id === o.event.campaign_id);
  if (!o || !brief) notFound();
  const basePath = `/events/${o.event.slug}`;
  // The ABM target accounts (Target_Account__c), minus Enterprise customers, who aren't invited through this flow.
  const plans = s.accounts.filter((a) => a.target_account && !isEnterpriseCustomer(s, a)).map((a) => accountPlan(s, a, brief));
  const count = (p: (typeof plans)[number], status: string) => p.executives.filter((e) => e.status === status).length;
  const fits = plans.filter((p) => !p.excluded).sort((x, y) => count(y, "Qualified") - count(x, "Qualified") || count(y, "Review") - count(x, "Review"));
  const excluded = plans.filter((p) => p.excluded);
  const selected = fits.reduce((n, p) => n + p.executives.filter((e) => e.selected).length, 0);

  return (
    <>
      <EventHeader event={o.event} active="accounts" candidates={candidateCount(s, o.event.campaign_id)} />
      <Page>
        <Section
          title="Accounts"
          description={<>{fits.length} accounts fit the brief · {selected} {selected === 1 ? "executive" : "executives"} selected to invite. <Link href={`${basePath}/brief`} className="text-blue-900 hover:underline">Edit the brief</Link> to change who fits.</>}
        >
          <div className="material-base overflow-x-auto">
            <table className="w-full min-w-[880px] text-left">
              <thead className="border-b border-gray-alpha-400 text-label-12 text-gray-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Account</th>
                  <th className="px-4 py-3 font-medium">Commercial Context</th>
                  <th className="px-4 py-3 font-medium">Latest Signal</th>
                  <th className="px-4 py-3 font-medium">Executives</th>
                  <th className="px-4 py-3 font-medium"><span className="sr-only">Plan</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-alpha-400">
                {fits.map((p) => {
                  const picked = p.executives.filter((e) => e.selected).length;
                  const latest = p.signals.toSorted((x, y) => y.signal_date.localeCompare(x.signal_date))[0];
                  return (
                    <tr key={p.account.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="text-label-14 font-medium">{p.account.name}</p>
                        <p className="text-label-12 text-gray-900">{[p.account.icp_tier, p.account.segment, p.account.vertical].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-4 py-3.5"><Status color={p.state.color}>{p.state.label}</Status></td>
                      <td className="max-w-xs px-4 py-3">
                        {latest ? (
                          <>
                            <p className="text-label-13">{latest.title}</p>
                            <p className="text-label-12 text-gray-900">{p.signals.length} {p.signals.length === 1 ? "signal" : "signals"}</p>
                          </>
                        ) : (
                          <p className="text-label-13 text-gray-900">No signals yet</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-label-13">
                        <p>{count(p, "Qualified")} qualified · {count(p, "Review")} to review</p>
                        {picked > 0 && <Badge variant="blue">{picked} selected</Badge>}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <Link href={`${basePath}/accounts/${p.account.id}`} className="whitespace-nowrap text-label-13 font-medium text-blue-900 hover:underline">Open Plan →</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
      </Page>
    </>
  );
}
