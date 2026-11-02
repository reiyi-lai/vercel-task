import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Badge, Button, Page, PageHeader, Section, Status, Tags } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { accountInteractions, derivePlan, eventOverview, vercelUsage } from "@/lib/derive";
import { messageVars, sender } from "@/lib/outreach";
import { render, schedule, shortDate } from "@/lib/sequence";
import Outreach from "./outreach";

type Props = PageProps<"/events/[eventId]/candidates/[candidateId]">;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const interactionDot = { Current: "green", Former: "gray" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).candidateId;
  const contact = (await loadSnapshot()).contacts.find((c) => c.id === id);
  return { title: contact && `${contact.first_name} ${contact.last_name}` };
}

export default function PlanPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><InvitationPlan params={params} /></Suspense>;
}

async function InvitationPlan({ params }: Pick<Props, "params">) {
  const { eventId, candidateId } = await params;
  await connection(); // step due dates depend on today's date, so render at request time
  const s = await loadSnapshot();
  const overview = eventOverview(s, eventId);
  if (!overview || !s.contacts.some((c) => c.id === candidateId)) notFound();
  const { event } = overview;
  const plan = derivePlan(s, candidateId, event.campaign_id);
  const { target, targetOwner, account } = plan;
  const name = `${target.first_name} ${target.last_name}`;
  const usage = vercelUsage(s, plan.account.id);
  const brief = s.event_briefs.find((b) => b.campaign_id === event.campaign_id);
  const outreach = s.outreach.find((x) => x.campaign_id === event.campaign_id && x.contact_id === candidateId);
  const day = (d: Date | null) => d && shortDate(d);
  const steps = schedule(brief?.sequence ?? [], outreach).map(({ step, index, due, sent, status }) => {
    const vars = messageVars(s, event.campaign_id, target, step);
    const from = sender(s, step, target);
    const done = outreach?.sent.find((x) => x.step === index); // once sent, show the copy that actually went out
    return {
      index, day: step.day, channel: step.channel, sender: `${from.first_name} ${from.last_name}`,
      subject: done?.body ? (done.subject ?? "") : render(step.subject, vars), body: done?.body ?? render(step.body, vars),
      status, due: day(due), sent: day(sent) && `${day(sent)}${done?.by ? ` by ${done.by} in Slack` : ""}`,
    };
  });
  const interactions = accountInteractions(s, target);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "All Events" }, { label: event.short_name, href: `/events/${event.slug}` }, { label: "Candidates", href: `/events/${event.slug}/candidates` }, { label: name }]}
        aside={<Badge>{account.icp_tier} · {account.type}</Badge>}
      >
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div>
            <h1 className="text-heading-32">{name}</h1>
            <p className="text-copy-14 text-gray-900">{target.title} · {account.name}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="text-label-13 text-gray-900">AE {targetOwner.first_name} {targetOwner.last_name}</span>
          <Tags vertical={account.vertical ?? "Other"} horizontals={account.horizontals} />
        </div>
      </PageHeader>

      <Page>
        <Section
          title="Vercel Usage"
          aside={usage.teams.length > 0 && (
            <p className="text-label-13 text-gray-900">
              {usage.activeUsers} active users · {usage.teams.length} teams · {usd.format(usage.monthlySpend)}/mo
            </p>
          )}
        >
          {usage.teams.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">No Vercel teams on this account yet.</p>
          ) : (
            <ul className="material-base divide-y divide-gray-alpha-400 overflow-hidden">
              {usage.teams.map((t, i) => (
                <li key={t.id} className={`grid items-center gap-3 px-5 py-4 sm:grid-cols-[220px_1fr_130px_110px_90px_120px] sm:gap-6 ${i === 0 ? "bg-blue-100" : ""}`}>
                  <div className="min-w-0">
                    <p className="truncate text-label-14 font-medium">{t.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5 text-label-12 text-gray-900">
                      {t.plan}
                      {i === 0 && <Badge variant="blue">Highest spend</Badge>}
                    </div>
                  </div>
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={t.key_contact_name ?? "?"} />
                    <div className="min-w-0">
                      <p className="truncate text-label-14 font-medium">{t.key_contact_name}</p>
                      <p className="truncate text-label-12 text-gray-900">{t.key_contact_title}</p>
                    </div>
                  </div>
                  <div><Badge variant={t.key_contact_id ? "amber" : "gray"}>{t.key_contact_id ? "In Salesforce" : "Not in Salesforce"}</Badge></div>
                  <p className="text-label-13 text-gray-900">{t.active_users_30d} active {t.active_users_30d === 1 ? "user" : "users"}</p>
                  <p className="text-label-13 text-gray-900">{usd.format(t.monthly_spend ?? 0)}/mo</p>
                  <div className="flex sm:justify-end">{i === 0 && <Button>Add Context</Button>}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Outreach
          campaignId={event.campaign_id}
          contactId={candidateId}
          outreach={outreach}
          steps={steps}
          to={{ email: target.email, linkedinUrl: target.linkedin_url?.includes("linkedin.example") ? null : target.linkedin_url }}
        />

        <Section title="Past Account Interactions">
          {interactions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">No past interactions with anyone else at {account.name}.</p>
          ) : (
            <ul className="material-base divide-y divide-gray-alpha-400 overflow-hidden">
              {interactions.map((r) => (
                <li key={r.contact.id} className="grid items-center gap-3 px-5 py-4 lg:grid-cols-[220px_260px_1fr] lg:gap-6">
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
                    <p className="text-label-12 text-gray-900">SOURCES: {[...new Set(r.lines.map((l) => l.source))].join(" · ")}</p>
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
