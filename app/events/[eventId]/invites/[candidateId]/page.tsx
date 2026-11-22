import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Badge, Page, PageHeader, Section, Status, Tags } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { vercelUsage } from "@/lib/derive";
import { stepViews } from "@/lib/outreach";
import { pushDeadline } from "@/lib/sequence";
import { engagement } from "@/lib/qualify";
import Outreach from "../outreach";

type Props = PageProps<"/events/[eventId]/invites/[candidateId]">;

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

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
  const steps = stepViews(s, event, target, outreach);
  const base = `/events/${event.slug}`;

  return (
    <>
      <PageHeader
        crumbs={[{ label: event.short_name, href: base }, { label: "Invites", href: `${base}/invites` }, { label: name }]}
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
        {/* What to know while writing the outreach: how warm they are, and the account's Vercel usage. */}
        <Section title="Context">
          <div className="material-base grid gap-4 p-5 text-copy-13 sm:grid-cols-2">
            <div className="space-y-1.5">
              <p className="text-label-12 text-gray-900">Prior Engagement</p>
              <ul className="space-y-1">
                {engagement(s, target, event.campaign_id).labels.map((l) => (
                  <li key={l.text}>
                    <Status color={l.color}>{l.text}</Status>
                    {l.detail && <p className="pl-3.5 text-label-12 text-gray-900">{l.detail}</p>}
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-1.5">
              <p className="text-label-12 text-gray-900">Vercel Usage</p>
              <p>
                {usage.teams.length
                  ? `${usage.teams.length} Pro ${usage.teams.length === 1 ? "team" : "teams"} · ${usage.activeUsers} active users · ${usd.format(usage.monthlySpend)}/mo`
                  : "No Vercel teams on this domain."}
              </p>
            </div>
          </div>
        </Section>

        <Outreach
          campaignId={event.campaign_id}
          contactId={candidateId}
          outreach={outreach}
          steps={steps}
          deadline={outreach && pushDeadline(outreach)}
          to={{ email: target.email, linkedinUrl: target.linkedin_url?.includes("linkedin.example") ? null : target.linkedin_url }}
        />

      </Page>
    </>
  );
}
