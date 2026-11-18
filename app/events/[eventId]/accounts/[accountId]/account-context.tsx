import type { ReactNode } from "react";
import { Badge, Section, Status } from "@/components/ui";
import { relevantTheme } from "@/lib/brief";
import type { Account, EventBrief, Snapshot } from "@/lib/data";
import { formatDate, vercelUsage } from "@/lib/derive";
import { accountPlan } from "@/lib/qualify";
import { profileKey } from "@/lib/sumble";
import { AddToCrm, RefreshSignals } from "./controls";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const CATEGORY = { leadership: "Leadership Change", initiative: "AI Initiative" };
// Each category with no signals yet gets a row saying so, and which button looks for them.
const EMPTY = { leadership: "No leadership changes found yet.", initiative: "No AI initiatives found yet." };
const EMPTY_ACTION = { leadership: "Get Leadership Changes to look for them.", initiative: "Research AI Initiatives to look for them." };

// An account's shared context for an event: Vercel usage, relationship, event history and signals. The account plan
// (which puts its executives in as children, before the signals), and the Account Context on each invitation plan.
export default function AccountContext({ s, account, brief, children }: { s: Snapshot; account: Account; brief: EventBrief; children?: ReactNode }) {
  const plan = accountPlan(s, account, brief);
  const contacts = s.contacts.filter((c) => c.account_id === account.id);
  const name = (id: string) => contacts.find((c) => c.id === id)!;
  const opps = s.opportunities.filter((x) => x.account_id === account.id).sort((a, b) => Number(a.is_closed) - Number(b.is_closed));
  const roles = s.opportunity_contact_roles.filter((r) => opps.some((x) => x.id === r.opportunity_id));
  const lastMeeting = s.activities.filter((x) => x.account_id === account.id && x.subtype === "Meeting").sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  const history = s.campaign_members.filter((m) => contacts.some((c) => c.id === m.contact_id));
  const usage = vercelUsage(s, account.id);
  const live = !account.website?.endsWith(".example");
  const inCrm = new Set(contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));

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

        {children}

        <Section
          title="Signals"
          description={plan.signals.some((x) => x.source === "Sample data") ? "Sample signals for this fictional account; real accounts fetch live ones." : "Leadership changes from Sumble people, initiatives from web research."}
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
            {plan.signals.map(signalRow)}
            {(Object.keys(CATEGORY) as (keyof typeof CATEGORY)[]).filter((k) => !plan.signals.some((x) => x.category === k)).map((k) => (
              <li key={k} className="grid gap-2 px-5 py-4 sm:grid-cols-[180px_1fr_auto] sm:gap-6">
                <p className="text-label-12 font-medium uppercase tracking-wide text-gray-900">{CATEGORY[k]}</p>
                <p className="text-copy-13 text-gray-900">{EMPTY[k]}{live && ` ${EMPTY_ACTION[k]}`}</p>
              </li>
            ))}
          </ul>
        </Section>

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
