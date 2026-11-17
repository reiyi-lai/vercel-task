import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Badge, Chevron, Page, PageHeader, Section, Status, Tags } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { accountInteractions, vercelUsage } from "@/lib/derive";
import { draftCopy, execName, sender } from "@/lib/outreach";
import { schedule, shortDate } from "@/lib/sequence";
import AccountContext from "../../accounts/[accountId]/account-context";
import Outreach from "../outreach";

type Props = PageProps<"/events/[eventId]/candidates/[candidateId]">;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const interactionDot = { Current: "green", Former: "gray" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = (await params).candidateId;
  const contact = (await loadSnapshot()).contacts.find((c) => c.id === id);
  return { title: contact && `${contact.first_name} ${contact.last_name}` };
}

export default function InvitationPlanPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><InvitationPlan params={params} /></Suspense>;
}

// One candidate's invitation plan for an event: the outreach sequence with drafts, their Vercel usage, and past
// interactions at the account.
async function InvitationPlan({ params }: Pick<Props, "params">) {
  const { eventId, candidateId } = await params;
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
      index, day: step.day, channel: step.channel, ...copy,
      sender: step.sender === "Exec"
        ? `${execName(s, event.campaign_id, target) ?? "Exec unassigned"} (draft by ${by ? by.first_name : "AE"})`
        : by ? `${by.first_name} ${by.last_name}` : `${step.sender} unassigned`,
      edited: !done && !!outreach?.drafts?.[index],
      status, due: day(due), sent: day(sent) && `${day(sent)}${done?.by ? ` by ${done.by} in Slack` : ""}`,
    };
  });
  const interactions = accountInteractions(s, target);
  const base = `/events/${event.slug}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: event.short_name, href: base }, { label: "Candidates", href: `${base}/candidates` }, { label: name }]}
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
        <Outreach
          campaignId={event.campaign_id}
          contactId={candidateId}
          outreach={outreach}
          steps={steps}
          to={{ email: target.email, linkedinUrl: target.linkedin_url?.includes("linkedin.example") ? null : target.linkedin_url }}
        />

        {/* The top of the account plan, collapsed until wanted while writing the outreach. */}
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
            <h2 className="text-heading-20">Account Context</h2>
            <Chevron open={false} className="text-gray-900 group-open:rotate-180" />
          </summary>
          <div className="mt-4 space-y-6">
            <AccountContext s={s} account={account} brief={event} />
          </div>
        </details>
      </Page>
    </>
  );
}
