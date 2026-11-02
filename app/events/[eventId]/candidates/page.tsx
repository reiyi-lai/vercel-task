import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Page, PersonName, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { derivePlan, eventOverview, formatDate } from "@/lib/derive";
import { qualifyContact } from "@/lib/qualify";
import { progress } from "@/lib/sequence";
import EventHeader, { candidateCount } from "../event-header";
import CandidatesTable from "./candidates-table";
import FindEmail from "./find-email";
import SendReminders from "./send-reminders";

type Props = PageProps<"/events/[eventId]/candidates">;

const statusColor = { Qualified: "green", Review: "amber", Excluded: "red" } as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Candidates · ${event.short_name}` };
}

export default function CandidatesPage({ params }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Candidates params={params} /></Suspense>;
}

// Everyone selected to invite on this event's account plans, then candidates imported by CSV.
async function Candidates({ params }: Pick<Props, "params">) {
  const { eventId } = await params;
  await connection(); // outreach status depends on today's date, so render at request time
  const s = await loadSnapshot();
  const o = eventOverview(s, eventId);
  const brief = o && s.event_briefs.find((b) => b.campaign_id === o.event.campaign_id);
  if (!o || !brief) notFound();
  const { event } = o;
  const alerts = s.slack_alerts.filter((a) => a.campaign_id === event.campaign_id).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 10);
  const imported = s.candidates.filter((c) => c.campaign_id === event.campaign_id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const selected = s.invitation_selections
    .filter((x) => x.campaign_id === event.campaign_id)
    .map((x) => {
      const contact = s.contacts.find((c) => c.id === x.contact_id)!;
      const owner = s.users.find((u) => u.id === contact.owner_id);
      return {
        contact,
        account: s.accounts.find((a) => a.id === contact.account_id)!,
        owner: owner && `${owner.first_name} ${owner.last_name}`,
        qualified: qualifyContact(s, contact, brief),
        top: derivePlan(s, contact.id, event.campaign_id).ladder[0],
        outreach: progress(brief.sequence, s.outreach.find((o) => o.campaign_id === event.campaign_id && o.contact_id === contact.id)),
      };
    })
    .sort((a, b) => a.account.name.localeCompare(b.account.name) || a.contact.last_name.localeCompare(b.contact.last_name));

  return (
    <>
      <EventHeader event={event} active="candidates" candidates={candidateCount(s, event.campaign_id)} />
      <Page>
        <Section
          title="Selected Executives"
          description={<>Everyone selected to invite on this event’s <Link href={`/events/${event.slug}/accounts`} className="text-blue-900 hover:underline">account plans</Link>. Open an invitation plan for the warm route and drafts.</>}
        >
          {selected.length ? (
            <ul className="material-base divide-y divide-gray-alpha-400">
              {selected.map(({ contact: c, account, owner, qualified, top, outreach }) => (
                <li key={c.id} className="grid items-start gap-3 px-5 py-4 lg:grid-cols-[260px_200px_1fr_220px_130px] lg:gap-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={`${c.first_name} ${c.last_name}`} />
                    <div className="min-w-0">
                      <PersonName name={`${c.first_name} ${c.last_name}`} linkedinUrl={c.linkedin_url} />
                      <p className="text-label-12 text-gray-900">{c.title}</p>
                      {c.email && <p className="text-label-12 text-gray-900">{c.email}</p>}
                    </div>
                  </div>
                  <div className="text-label-13">
                    <Link href={`/events/${event.slug}/accounts/${account.id}`} className="font-medium hover:underline">{account.name}</Link>
                    {owner && <p className="text-label-12 text-gray-900">AE {owner}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Status color={statusColor[qualified.status]}>{qualified.status}</Status>
                    <ul className="flex flex-wrap gap-x-4 gap-y-1">
                      {qualified.labels.map((l) => <li key={l.text}><Status color={l.color}><span className="text-label-12">{l.text}</span></Status></li>)}
                    </ul>
                  </div>
                  <div className="space-y-1.5 text-label-12">
                    <Status color={outreach.color}><span className="text-label-12">{outreach.text}</span></Status>
                    {top && (
                      <>
                        <p className="text-gray-900">Best route</p>
                        <p>{top.route} · {top.connector.name}</p>
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-start gap-2 lg:justify-self-end">
                    <Link href={`/events/${event.slug}/candidates/${c.id}`} className="whitespace-nowrap text-label-13 font-medium text-blue-900 hover:underline">Invitation Plan →</Link>
                    {!c.email && c.linkedin_url && !c.linkedin_url.includes("linkedin.example") && <FindEmail contactId={c.id} />}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">
              No one selected yet. Select executives on the <Link href={`/events/${event.slug}/accounts`} className="text-blue-900 hover:underline">account plans</Link>.
            </p>
          )}
        </Section>

        <Section
          title="Slack Alerts"
          description={process.env.SLACK_WEBHOOK_URL ? "Also posted to Slack." : "Shown here only: add SLACK_WEBHOOK_URL to post them to Slack."}
          aside={<SendReminders campaignId={event.campaign_id} />}
        >
          {alerts.length ? (
            <ul className="material-base divide-y divide-gray-alpha-400">
              {alerts.map((a) => (
                <li key={a.id} className="grid gap-1 px-5 py-3 sm:grid-cols-[160px_1fr_auto] sm:gap-6">
                  <p className="text-label-13 font-medium">{a.recipient}</p>
                  <p className="text-copy-13">{a.text}</p>
                  <p className="text-label-12 text-gray-900">{formatDate(a.created_at)}{a.posted && " · Slack"}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">No alerts yet. They appear when a sequence starts, a candidate responds, or steps fall due.</p>
          )}
        </Section>

        <CandidatesTable campaignId={event.campaign_id} candidates={imported} />
      </Page>
    </>
  );
}
