import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Avatar, Badge, Page, PageHeader, PersonName, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventDetails } from "@/lib/derive";
import { accountPlan } from "@/lib/qualify";
import { profileKey } from "@/lib/sumble";
import AccountContext from "./account-context";
import { FindExecutives, SelectExecutive } from "./controls";

type Props = PageProps<"/events/[eventId]/accounts/[accountId]">;

const statusColor = { Qualified: "green", Review: "amber", Excluded: "red" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { accountId } = await params;
  return { title: (await loadSnapshot()).accounts.find((a) => a.id === accountId)?.name };
}

export default function AccountPlanPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><AccountPlan params={params} /></Suspense>;
}

// One account's plan for one event: the shared context first (relationship, usage, signals, industry, event history),
// then its executives, where the BDR picks who to invite and opens each person's invitation plan.
async function AccountPlan({ params }: Pick<Props, "params">) {
  const { eventId, accountId } = await params;
  const s = await loadSnapshot();
  const event = eventDetails(s, eventId);
  const brief = event && s.events.find((b) => b.campaign_id === event.campaign_id);
  const account = s.accounts.find((a) => a.id === accountId);
  if (!event || !brief || !account) notFound();
  const plan = accountPlan(s, account, brief);
  const owner = s.users.find((u) => u.id === account.owner_id);
  const contacts = s.contacts.filter((c) => c.account_id === account.id);
  const live = !account.website?.endsWith(".example");
  const inCrm = new Set(contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
  const base = `/events/${event.slug}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: event.short_name, href: base }, { label: "Accounts", href: `${base}/accounts` }, { label: account.name }]}
        aside={plan.excluded ? <Status color="red">Outside the brief: {plan.excluded}</Status> : <Status color={plan.state.color}>{plan.state.label}</Status>}
      >
        <h1 className="text-heading-32">{account.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {[account.icp_tier, account.vertical].filter(Boolean).map((x) => <Badge key={x}>{x}</Badge>)}
          {account.horizontals.map((h) => <Badge key={h} variant="outline">{h}</Badge>)}
          <span className="text-label-13 text-gray-900">AE {owner ? `${owner.first_name} ${owner.last_name}` : "Unassigned"} · {event.name}</span>
        </div>
      </PageHeader>

      <Page>
        <AccountContext s={s} account={account} brief={brief} />

        <Section title="Executives" description="Qualified against this event’s brief. Add candidates to invite, then open their invitation plan for the outreach drafts.">
          {live && (
            <div className="mb-4">
              <FindExecutives
                accountId={account.id}
                campaignId={event.campaign_id}
                found={s.found_executives.filter((x) => x.account_id === account.id && x.campaign_id === event.campaign_id)}
                inCrm={[...inCrm]}
              />
            </div>
          )}
          <ul className="material-base divide-y divide-gray-alpha-400">
            {plan.executives.map((e) => {
              const c = e.contact;
              return (
                <li key={c.id} className={`grid items-start gap-3 px-5 py-4 lg:grid-cols-[260px_1fr_160px] lg:gap-6 ${e.status === "Excluded" ? "opacity-60" : ""}`}>
                  <div className="flex items-center gap-3">
                    <Avatar name={`${c.first_name} ${c.last_name}`} />
                    <div className="min-w-0">
                      <PersonName name={`${c.first_name} ${c.last_name}`} linkedinUrl={c.linkedin_url} />
                      <p className="text-label-12 text-gray-900">{c.title}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Status color={statusColor[e.status]}>{e.status}</Status>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {e.labels.map((l) => <li key={l.text}><Status color={l.color}><span className="text-label-12">{l.text}</span></Status></li>)}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-2 lg:items-end">
                    {e.status !== "Excluded" && (
                      <>
                        <SelectExecutive campaignId={event.campaign_id} contactId={c.id} name={`${c.first_name} ${c.last_name}`} selected={e.selected} />
                        <Link href={`/events/${event.slug}/candidates/${c.id}`} className="whitespace-nowrap text-label-13 font-medium text-blue-900 hover:underline">Invitation Plan →</Link>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </Section>
      </Page>
    </>
  );
}
