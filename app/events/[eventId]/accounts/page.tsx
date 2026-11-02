import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Page, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventDetails, vercelUsage } from "@/lib/derive";
import { accountPlan, isEnterpriseCustomer } from "@/lib/qualify";
import EventHeader, { candidateCount } from "../event-header";

type Props = PageProps<"/events/[eventId]/accounts">;

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
  // The ABM target accounts (Target_Account__c), minus Enterprise customers, who aren't invited through this flow.
  const plans = s.accounts.filter((a) => a.target_account && !isEnterpriseCustomer(s, a)).map((a) => accountPlan(s, a, brief));
  const count = (p: (typeof plans)[number], status: string) => p.executives.filter((e) => e.status === status).length;
  const fits = plans.filter((p) => !p.excluded).sort((x, y) => count(y, "Qualified") - count(x, "Qualified") || count(y, "Review") - count(x, "Review"));
  const excluded = plans.filter((p) => p.excluded);
  const selected = fits.reduce((n, p) => n + p.executives.filter((e) => e.selected).length, 0);

  return (
    <>
      <EventHeader event={event} active="accounts" candidates={candidateCount(s, event.campaign_id)} />
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
                    <tr key={p.account.id} className="align-top">
                      <td className="px-4 py-3">
                        <p className="text-label-14 font-medium">{p.account.name}</p>
                        <p className="text-label-12 text-gray-900">{[p.account.icp_tier, p.account.vertical].filter(Boolean).join(" · ")}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        {usage.teams.length ? (
                          <Status color="green">
                            {usage.teams.length} Pro {usage.teams.length === 1 ? "team" : "teams"} · {usage.activeUsers} active users · {usd.format(usage.monthlySpend)}/mo
                          </Status>
                        ) : (
                          <Status color="gray">No Pro teams</Status>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-label-13">
                        {p.executives.filter((e) => e.status !== "Excluded").length} to review · {picked} selected
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
