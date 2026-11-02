import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Badge, Page, PageHeader, Section, Status, Tags } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { accountInteractions, vercelUsage } from "@/lib/derive";
import { draftCopy, sender } from "@/lib/outreach";
import { schedule, shortDate } from "@/lib/sequence";
import Outreach from "../outreach";

type Props = PageProps<"/events/[eventId]/candidates/[candidateId]">;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const interactionDot = { Current: "green", Former: "gray" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).candidateId;
  const contact = (await loadSnapshot()).contacts.find((c) => c.id === id);
  return { title: contact && `${contact.first_name} ${contact.last_name}` };
}

export default function InvitationPlanPage({ params, searchParams }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><InvitationPlan params={params} searchParams={searchParams} /></Suspense>;
}

// One candidate's invitation plan for an event: the outreach sequence with drafts, their Vercel usage, and past
// interactions at the account. ?from=outreach&as=<user id> (from For AE/BDR) points the back link at that queue;
// otherwise it goes back to the event's Candidates.
async function InvitationPlan({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { eventId, candidateId } = await params;
  const { from, as } = await searchParams;
  await connection(); // step due dates depend on today's date
  const s = await loadSnapshot();
  const event = s.events.find((e) => e.slug === eventId);
  const target = s.contacts.find((c) => c.id === candidateId);
  if (!event || !target) notFound();
  const account = s.accounts.find((a) => a.id === target.account_id)!;
  const ae = s.users.find((u) => u.id === target.owner_id);
  const name = `${target.first_name} ${target.last_name}`;
  const usage = vercelUsage(s, account.id);
  const outreach = s.candidates.find((x) => x.campaign_id === event.campaign_id && x.contact_id === candidateId);
  const day = (d: Date | null) => d && shortDate(d);
  const steps = schedule(event.sequence, outreach).map(({ step, index, due, sent, status }) => {
    const by = sender(s, event.campaign_id, step, target);
    const done = outreach?.sent.find((x) => x.step === index);
    // The copy that went out once sent; before that, the saved edit or the template filled in.
    const copy = done?.body ? { subject: done.subject ?? "", body: done.body } : draftCopy(s, event.campaign_id, target, index);
    return {
      index, day: step.day, channel: step.channel, sender: by ? `${by.first_name} ${by.last_name}` : `${step.sender} unassigned`, ...copy,
      edited: !done && !!outreach?.drafts?.[index],
      status, due: day(due), sent: day(sent) && `${day(sent)}${done?.by ? ` by ${done.by} in Slack` : ""}`,
    };
  });
  const interactions = accountInteractions(s, target);
  const base = `/events/${event.slug}`;
  const back = from === "outreach" ? { label: "For AE/BDR", href: `/outreach${typeof as === "string" ? `?as=${as}` : ""}` } : { label: "Candidates", href: `${base}/candidates` };

  return (
    <>
      <PageHeader
        crumbs={[{ label: event.short_name, href: base }, { label: "Candidates", href: `${base}/candidates` }, { label: name }]}
        aside={<Link href={`${base}/accounts/${account.id}`} className="text-label-13 text-blue-900 hover:underline">Account Plan →</Link>}
      >
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div>
            <h1 className="text-heading-32">{name}</h1>
            <p className="text-copy-14 text-gray-900">{target.title} · {account.name}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-label-13 text-gray-900">AE {ae ? `${ae.first_name} ${ae.last_name}` : "Unassigned"}</span>
          <Badge>{account.icp_tier} · {account.type}</Badge>
          <Tags vertical={account.vertical ?? "Other"} horizontals={account.horizontals} />
        </div>
      </PageHeader>

      <Page>
        <Link href={back.href} className="-mb-4 flex w-fit items-center gap-1.5 text-label-13 text-gray-900 hover:text-gray-1000">
          <span aria-hidden>←</span> {back.label}
        </Link>

        <Outreach
          campaignId={event.campaign_id}
          contactId={candidateId}
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
                <li key={r.contact.id} className="grid items-center gap-3 px-5 py-4 lg:grid-cols-[220px_200px_1fr] lg:gap-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={r.name} />
                    <div className="min-w-0">
                      <p className="text-label-14 font-medium">{r.name}</p>
                      <p className="text-label-12 text-gray-900">{r.contact.title}</p>
                    </div>
                  </div>
                  <Status color={interactionDot[r.status]}>{r.status} Employee</Status>
                  <div className="space-y-1.5">
                    <ul className="space-y-0.5">
                      {r.lines.map((l) => <li key={l.text} className="text-copy-13">{l.text}</li>)}
                    </ul>
                    <p className="text-label-12 text-gray-900">Sources: {[...new Set(r.lines.map((l) => l.source))].join(" · ")}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Page>
    </>
  );
}
