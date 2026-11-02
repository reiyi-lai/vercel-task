import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Avatar, Badge, Page, PageHeader, PersonName, Section, Status } from "@/components/ui";
import { relevantTheme } from "@/lib/brief";
import { loadSnapshot } from "@/lib/data";
import { eventDetails, formatDate, vercelUsage } from "@/lib/derive";
import { accountPlan, eventAccounts } from "@/lib/qualify";
import { profileKey } from "@/lib/sumble";
import { AddToCrm, FindExecutives, RefreshSignals, SelectExecutive } from "./controls";

type Props = PageProps<"/events/[eventId]/accounts/[accountId]">;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CATEGORY = { hiring: "Hiring & Tech Adoption", leadership: "Leadership Change", initiative: "AI Initiative" };
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
  const name = (id: string) => contacts.find((c) => c.id === id)!;
  const opps = s.opportunities.filter((x) => x.account_id === account.id).sort((a, b) => Number(a.is_closed) - Number(b.is_closed));
  const roles = s.opportunity_contact_roles.filter((r) => opps.some((x) => x.id === r.opportunity_id));
  const lastMeeting = s.activities.filter((x) => x.account_id === account.id && x.subtype === "Meeting").sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  const history = s.campaign_members.filter((m) => contacts.some((c) => c.id === m.contact_id));
  const usage = vercelUsage(s, account.id);
  const live = !account.website?.endsWith(".example");
  const inCrm = new Set(contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
  // Previous and next in the Accounts list's order, so the BDR can work through the accounts without going back to it.
  const order = eventAccounts(s, brief).fits.map((p) => p.account);
  const at = order.findIndex((a) => a.id === account.id);
  const [prev, next] = at < 0 ? [] : [order[at - 1], order[at + 1]];
  const candidates = s.candidates.filter((x) => x.campaign_id === event.campaign_id).length;
  const base = `/events/${event.slug}`;

  const signalRow = (x: (typeof plan.signals)[number]) => (
    <li key={`${x.source}${x.title}`} className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr_auto] sm:gap-6">
      <div className="space-y-1.5">
        <p className="text-label-12 font-medium uppercase tracking-wide text-gray-900">{CATEGORY[x.category]}</p>
        {x.theme && <Badge variant={relevantTheme(x.theme, brief) ? "blue" : "outline"}>{x.theme}</Badge>}
      </div>
      <div>
        <p className="text-label-14 font-medium">{x.title}</p>
        {x.detail && <p className="text-copy-13 text-gray-900">{x.detail}</p>}
      </div>
      <div className="text-label-12 text-gray-900 sm:text-right">
        <p>{formatDate(x.signal_date)}</p>
        {x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="text-blue-900 hover:underline">{x.source} ↗</a> : <p>{x.source}</p>}
        {x.person_linkedin_url && (
          <div className="mt-2">
            {inCrm.has(profileKey(x.person_linkedin_url)) ? <Status color="green">In CRM</Status> : live && <AddToCrm accountId={account.id} linkedinUrl={x.person_linkedin_url} />}
          </div>
        )}
      </div>
    </li>
  );

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
        <nav aria-label="Accounts" className="-mb-4 flex flex-wrap items-center justify-between gap-3 text-label-13">
          {prev ? <Link href={`${base}/accounts/${prev.id}`} className="text-gray-900 hover:text-gray-1000">← {prev.name}</Link> : <span />}
          <Link href={`${base}/candidates`} className="font-medium text-blue-900 hover:underline">{candidates} {candidates === 1 ? "candidate" : "candidates"} added · Go to Candidates →</Link>
          {next ? <Link href={`${base}/accounts/${next.id}`} className="text-gray-900 hover:text-gray-1000">{next.name} →</Link> : <span />}
        </nav>

        <Block title="Vercel Usage" source="Vercel teams and billing">
          {usage.teams.length ? (
            <p className="text-copy-13">
              {usage.teams.length} {[...new Set(usage.teams.map((t) => t.plan))].join(" / ")} {usage.teams.length === 1 ? "team" : "teams"} · {usage.activeUsers} active users · {usd.format(usage.monthlySpend)}/mo
              <span className="block text-gray-900">Largest: {usage.teams[0].name}{`, billing owner ${usage.teams[0].key_contact_name ?? usage.teams[0].key_contact_title ?? "not on file"}`}</span>
            </p>
          ) : (
            <p className="text-copy-13 text-gray-900">No Vercel teams on this domain.</p>
          )}
        </Block>

        <div className="grid gap-6 lg:grid-cols-2">
          <Block title="Relationship" source="Salesforce">
            <ul className="space-y-1.5 text-copy-13">
              {opps.map((x) => (
                <li key={x.id}>
                  <Status color={x.is_won ? "green" : x.is_closed ? "gray" : "blue"}>{x.name.split(" — ").pop()} · {x.stage}{x.amount ? ` · ${usd.format(x.amount)}` : ""}</Status>
                </li>
              ))}
              {!opps.length && <li className="text-gray-900">No opportunities</li>}
              {roles.map((r) => <li key={r.id} className="text-gray-900">{r.role}: {`${name(r.contact_id).first_name} ${name(r.contact_id).last_name}`}</li>)}
              <li className="text-gray-900">Last meeting: {lastMeeting ? formatDate(lastMeeting.occurred_at) : "none logged"}</li>
            </ul>
          </Block>

          <Block title="Event History" source="Salesforce campaigns">
            {history.length ? (
              <ul className="space-y-1 text-copy-13">
                {history.map((m) => (
                  <li key={`${m.campaign_id}${m.contact_id}`}>
                    {name(m.contact_id).first_name} {name(m.contact_id).last_name} · {s.campaigns.find((c) => c.id === m.campaign_id)!.name}
                    <span className="text-gray-900"> · {m.invite_status}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-copy-13 text-gray-900">Not invited to any event yet.</p>
            )}
          </Block>
        </div>

        <Section
          title="Signals"
          description={plan.signals.some((x) => x.source === "Sample data") ? "Sample signals for this fictional account; real accounts fetch live ones." : "Hiring from Sumble job posts, leadership changes from Sumble people, initiatives from web research."}
          aside={
            live && (
              <div className="flex flex-wrap items-start gap-2">
                <RefreshSignals accountId={account.id} group="sumble" />
                <RefreshSignals accountId={account.id} group="research" />
              </div>
            )
          }
        >
          <ul className="material-base divide-y divide-gray-alpha-400">
            {plan.signals.filter((x) => x.category !== "hiring").map(signalRow)}
            {!plan.signals.some((x) => x.category === "initiative") && (
              <li className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr_auto] sm:gap-6">
                <p className="text-label-12 font-medium uppercase tracking-wide text-gray-900">{CATEGORY.initiative}</p>
                <p className="text-copy-13 text-gray-900">No AI initiatives found yet.{live && " Research AI Initiatives to look for them."}</p>
              </li>
            )}
            {plan.signals.filter((x) => x.category === "hiring").map(signalRow)}
          </ul>
        </Section>

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

function Block({ title, source, children }: { title: string; source?: string; children: ReactNode }) {
  return (
    <section className="material-base space-y-3 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-heading-16">{title}</h2>
        {source && <span className="text-label-12 text-gray-900">{source}</span>}
      </div>
      {children}
    </section>
  );
}
