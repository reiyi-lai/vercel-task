import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Page, PersonName, Section, Status, TabLinks } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventOverview } from "@/lib/derive";
import { OUTREACH_LEADS, sentByBdr } from "@/lib/brief";
import { qualifyContact } from "@/lib/qualify";
import { progress, pushDeadline, STAGES, stageOf } from "@/lib/sequence";
import { assignAe, assignBdr } from "../contacts/actions";
import EventHeader from "../event-header";
import Assign from "./assign";
import { SelectCheckbox, SelectionProvider } from "@/components/selection";
import { RemoveSelected } from "./remove";
import FindEmail from "./find-email";
import StartSequence, { PushSelected } from "./start-sequence";
import { Approve, ApproveSelected } from "./approve";

type Props = PageProps<"/events/[eventId]/invites">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Invites · ${event.short_name}` };
}

export default function InvitesPage({ params, searchParams }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Invites params={params} searchParams={searchParams} /></Suspense>;
}

// Everyone selected to invite on this event's Accounts page, a tab per stage (?stage=), each with the action it needs:
// marketing approves, then the AE or BDR pushes to Outreach, then the sequence runs. Opens on the first stage with anyone in it.
async function Invites({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { eventId } = await params;
  const { stage: asked } = await searchParams;
  await connection(); // outreach status depends on today's date, so render at request time
  const s = await loadSnapshot();
  const o = eventOverview(s, eventId);
  const brief = o && s.events.find((b) => b.campaign_id === o.event.campaign_id);
  if (!o || !brief) notFound();
  const { event } = o;
  const people = (title: string) => s.users.filter((u) => u.title === title).map((u) => ({ id: u.id, name: `${u.first_name} ${u.last_name}` }));
  const aes = people("Account Executive");
  const bdrs = people("BDR");
  const selected = s.candidates
    .filter((x) => x.campaign_id === event.campaign_id)
    .map((x) => {
      const contact = s.contacts.find((c) => c.id === x.contact_id)!;
      return {
        contact,
        account: s.accounts.find((a) => a.id === contact.account_id)!,
        bdrId: x.bdr_id,
        execName: x.exec_name ?? brief.exec_name,
        qualified: qualifyContact(s, contact, brief),
        outreach: progress(brief.sequence, x),
        approved: !!x.approved_at,
        started: !!x.started_at,
        stage: stageOf(x),
        deadline: pushDeadline(x),
      };
    })
    .sort((a, b) => a.account.name.localeCompare(b.account.name) || a.contact.last_name.localeCompare(b.contact.last_name));
  const count = (key: string) => selected.filter((x) => x.stage === key).length;
  const stage = STAGES.find((st) => st.key === asked) ?? STAGES.find((st) => count(st.key)) ?? STAGES[0];
  // Overdue pushes first.
  const shown = selected.filter((x) => x.stage === stage.key).sort((a, b) => Number(!!b.deadline?.overdue) - Number(!!a.deadline?.overdue));
  const EMPTY: Record<string, string> = {
    approval: "No one waiting for approval.",
    push: "No approved candidates waiting to be pushed to Outreach.",
    sequence: "No invites sent yet.",
    replied: "No replies yet.",
    accepted: "No acceptances yet.",
    declined: "No declines.",
  };

  return (
    <>
      <EventHeader event={event} page="Invites" />
      <Page>
        <SelectionProvider>
          <Section
            aside={<RemoveSelected campaignId={event.campaign_id} candidates={shown.map(({ contact: c, started }) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, started }))} />}
            title="Invites"
            description={<span className="text-label-13">Outreach: {OUTREACH_LEADS[brief.outreach_lead].label}</span>}
          >
            {/* The tabs, with the stage's bulk action at their right once anyone is ticked: Approve Selected, or Push Selected
                to Outreach (those with an email). */}
            <div className="mb-4 flex items-start justify-between gap-4 border-b border-gray-alpha-400">
              <div className="min-w-0 overflow-x-auto">
                <TabLinks variant="boxed" items={STAGES.map((st) => ({ label: st.label, count: count(st.key), href: `?stage=${st.key}`, active: st.key === stage.key }))} />
              </div>
              {stage.key === "approval" && <ApproveSelected campaignId={event.campaign_id} pending={shown.map((x) => x.contact.id)} />}
              {stage.key === "push" && (
                <PushSelected campaignId={event.campaign_id} ready={shown.filter((x) => x.contact.email).map(({ contact: c }) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` }))} />
              )}
            </div>
            {!selected.length ? (
              <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">
                No one selected yet. Select executives on <Link href={`/events/${event.slug}/contacts`} className="text-blue-900 hover:underline">Accounts</Link>.
              </p>
            ) : shown.length ? (
              <ul className="material-base divide-y divide-gray-alpha-400">
                {shown.map(({ contact: c, account, bdrId, execName, qualified, outreach, approved, started, deadline }) => (
                  <li key={c.id} className={`grid items-start gap-3 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_150px_140px_140px_200px_120px] xl:gap-5`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <SelectCheckbox id={c.id} name={`${c.first_name} ${c.last_name}`} />
                      <Avatar name={`${c.first_name} ${c.last_name}`} />
                      <div className="min-w-0">
                        <PersonName name={`${c.first_name} ${c.last_name}`} linkedinUrl={c.linkedin_url} />
                        <p className="text-label-12 text-gray-900">{c.title}</p>
                        {c.email && <p className="truncate text-label-12 text-gray-900" title={c.email}>{c.email}</p>}
                        <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {qualified.labels.map((l) => <li key={l.text}><Status color={l.color}><span className="text-label-12">{l.text}</span></Status></li>)}
                        </ul>
                      </div>
                    </div>
                    <div className="text-label-13">
                      <Link href={`/events/${event.slug}/contacts?account=${account.id}`} className="font-medium hover:underline">{account.name}</Link>
                    </div>
                    {brief.outreach_lead === "ae_bdr" ? (
                      // AE/BDR-led: the account's AE sends when it has one, otherwise a BDR picked here.
                      <div className="text-label-13">
                        <p className="text-label-12 text-gray-900">Sent By</p>
                        {sentByBdr("ae_bdr", account.owner_id) ? "BDR" : "AE"}
                      </div>
                    ) : (
                      <div className="text-label-13">
                        <p className="text-label-12 text-gray-900">AE</p>
                        {/* The AE is the account's Salesforce owner: assignable here only while the account has none. */}
                        {account.owner_id ? aes.find((u) => u.id === account.owner_id)?.name : <Assign label="AE" options={aes} value={null} action={assignAe.bind(null, account.id)} />}
                      </div>
                    )}
                    <div className="text-label-13">
                      <p className="text-label-12 text-gray-900">{brief.outreach_lead === "exec" ? "Exec Sign-off" : brief.outreach_lead === "bdr" ? "BDR" : "BDR/AE Name"}</p>
                      {brief.outreach_lead === "exec" ? (
                        execName ?? <span className="text-white">TBC (in Brief)</span>
                      ) : !sentByBdr(brief.outreach_lead, account.owner_id) ? (
                        aes.find((u) => u.id === account.owner_id)?.name
                      ) : started ? (
                        bdrs.find((u) => u.id === bdrId)?.name
                      ) : (
                        <Assign label="BDR" options={bdrs} value={bdrId} action={assignBdr.bind(null, event.campaign_id, c.id)} />
                      )}
                    </div>
                    <div className="space-y-1.5 text-label-12">
                      {started ? (
                        <Status color={outreach.color}><span className="text-label-12">{outreach.text}</span></Status>
                      ) : deadline ? (
                        <Status color={deadline.color}><span className="text-label-12">{deadline.text}</span></Status>
                      ) : (
                        <Status color={stage.color}><span className="text-label-12">{approved ? "Approved · not pushed" : "Pending Marketing Approval"}</span></Status>
                      )}
                    </div>
                    <div className="flex flex-col items-start gap-2 xl:justify-self-end">
                      <Link href={`/events/${event.slug}/invites/${c.id}`} className="whitespace-nowrap text-label-13 font-medium text-blue-900 hover:underline">Invitation Plan →</Link>
                      {stage.key === "push" && !c.email && c.linkedin_url && !c.linkedin_url.includes("linkedin.example") && <FindEmail contactId={c.id} />}
                      {!approved ? <Approve campaignId={event.campaign_id} contactIds={[c.id]} /> : c.email && !started && <StartSequence campaignId={event.campaign_id} contactId={c.id} />}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">{EMPTY[stage.key]}</p>
            )}
          </Section>
        </SelectionProvider>
      </Page>
    </>
  );
}
