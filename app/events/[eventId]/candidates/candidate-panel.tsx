import Link from "next/link";
import { Avatar, Badge, Section, Status, Tags } from "@/components/ui";
import type { EventRow, Snapshot } from "@/lib/data";
import { accountInteractions, vercelUsage } from "@/lib/derive";
import { draftCopy, sender } from "@/lib/outreach";
import { schedule, shortDate } from "@/lib/sequence";
import Outreach from "./outreach";
import PanelEscape from "./panel-escape";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const interactionDot = { Current: "green", Former: "gray" } as const;

// One candidate's invitation plan, as a panel over the Candidates list (?candidate=<id>), so working through the list
// never leaves it: their Vercel usage, the outreach sequence with drafts, and past interactions at the account.
// close: the list's URL without the candidate.
export default function CandidatePanel({ s, event, contactId, close }: { s: Snapshot; event: EventRow; contactId: string; close: string }) {
  const target = s.contacts.find((c) => c.id === contactId);
  if (!target) return null;
  const account = s.accounts.find((a) => a.id === target.account_id)!;
  const ae = s.users.find((u) => u.id === target.owner_id);
  const name = `${target.first_name} ${target.last_name}`;
  const usage = vercelUsage(s, account.id);
  const outreach = s.candidates.find((x) => x.campaign_id === event.campaign_id && x.contact_id === contactId);
  const day = (d: Date | null) => d && shortDate(d);
  const steps = schedule(event.sequence, outreach).map(({ step, index, due, sent, status }) => {
    const from = sender(s, event.campaign_id, step, target);
    const done = outreach?.sent.find((x) => x.step === index);
    // The copy that went out once sent; before that, the saved edit or the template filled in.
    const copy = done?.body ? { subject: done.subject ?? "", body: done.body } : draftCopy(s, event.campaign_id, target, index);
    return {
      index, day: step.day, channel: step.channel, sender: from ? `${from.first_name} ${from.last_name}` : `${step.sender} unassigned`, ...copy,
      edited: !done && !!outreach?.drafts?.[index],
      status, due: day(due), sent: day(sent) && `${day(sent)}${done?.by ? ` by ${done.by} in Slack` : ""}`,
    };
  });
  const interactions = accountInteractions(s, target);

  return (
    <>
      <PanelEscape close={close} />
      <Link href={close} scroll={false} aria-label="Close" className="fixed inset-0 z-20 bg-background-200/80" />
      <aside role="dialog" aria-modal="true" aria-label={name} className="fixed inset-y-0 right-0 z-30 w-full max-w-[760px] overflow-y-auto border-l border-gray-alpha-400 bg-background-100">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-gray-alpha-400 bg-background-100 px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar name={name} size="lg" />
            <div className="min-w-0">
              <h2 className="text-heading-24">{name}</h2>
              <p className="text-copy-14 text-gray-900">{target.title} · {account.name}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-label-13 text-gray-900">AE {ae ? `${ae.first_name} ${ae.last_name}` : "Unassigned"}</span>
                <Badge>{account.icp_tier} · {account.type}</Badge>
                <Tags vertical={account.vertical ?? "Other"} horizontals={account.horizontals} />
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Link href={`/events/${event.slug}/accounts/${account.id}`} className="text-label-13 text-blue-900 hover:underline">Account Plan</Link>
            <Link href={close} scroll={false} aria-label="Close" className="grid size-8 place-items-center rounded-lg text-gray-900 hover:bg-gray-100 hover:text-gray-1000">✕</Link>
          </div>
        </header>

        <div className="space-y-10 px-6 py-6">
          <Outreach
            campaignId={event.campaign_id}
            contactId={contactId}
            outreach={outreach}
            steps={steps}
            to={{ email: target.email, linkedinUrl: target.linkedin_url?.includes("linkedin.example") ? null : target.linkedin_url }}
          />

          <Section
            title="Vercel Usage"
            aside={usage.teams.length > 0 && <p className="text-label-13 text-gray-900">{usage.activeUsers} active users · {usd.format(usage.monthlySpend)}/mo</p>}
          >
            {usage.teams.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">No Vercel teams on this account yet.</p>
            ) : (
              <ul className="material-base divide-y divide-gray-alpha-400 overflow-hidden">
                {usage.teams.map((t) => (
                  <li key={t.id} className="grid items-center gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:gap-6">
                    <div className="min-w-0">
                      <p className="truncate text-label-14 font-medium">{t.name}</p>
                      <p className="text-label-12 text-gray-900">{t.plan} · {t.active_users_30d} active {t.active_users_30d === 1 ? "user" : "users"} · {usd.format(t.monthly_spend ?? 0)}/mo</p>
                    </div>
                    <div className="min-w-0">
                      <p className="text-label-12 text-gray-900">Billing Owner</p>
                      <p className="truncate text-label-13">{t.key_contact_name ?? t.key_contact_title ?? "Not on file"}</p>
                    </div>
                    <Badge variant={t.key_contact_id ? "amber" : "gray"}>{t.key_contact_id ? "In Salesforce" : "Not in Salesforce"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Past Account Interactions">
            {interactions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">No past interactions with anyone else at {account.name}.</p>
            ) : (
              <ul className="material-base divide-y divide-gray-alpha-400 overflow-hidden">
                {interactions.map((r) => (
                  <li key={r.contact.id} className="space-y-2 px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={r.name} />
                        <div className="min-w-0">
                          <p className="text-label-14 font-medium">{r.name}</p>
                          <p className="text-label-12 text-gray-900">{r.contact.title}</p>
                        </div>
                      </div>
                      <Status color={interactionDot[r.status]}>{r.status} Employee</Status>
                    </div>
                    <ul className="space-y-0.5">
                      {r.lines.map((l) => <li key={l.text} className="text-copy-13">{l.text}</li>)}
                    </ul>
                    <p className="text-label-12 text-gray-900">Sources: {[...new Set(r.lines.map((l) => l.source))].join(" · ")}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </aside>
    </>
  );
}
