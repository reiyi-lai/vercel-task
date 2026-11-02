import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Avatar, Page, PersonName, Section, Status } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { eventOverview } from "@/lib/derive";
import { qualifyContact } from "@/lib/qualify";
import { progress } from "@/lib/sequence";
import { assignAe, assignBdr } from "../accounts/[accountId]/actions";
import EventHeader from "../event-header";
import Assign from "./assign";
import { RemoveCheckbox, RemoveSelected, RemoveSelection } from "./remove";
import FindEmail from "./find-email";
import StartSequence from "./start-sequence";
import CandidatePanel from "./candidate-panel";

type Props = PageProps<"/events/[eventId]/candidates">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { eventId } = await params;
  const event = (await loadSnapshot()).events.find((e) => e.slug === eventId);
  return { title: event && `Candidates · ${event.short_name}` };
}

export default function CandidatesPage({ params, searchParams }: Props) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Candidates params={params} searchParams={searchParams} /></Suspense>;
}

// Everyone selected to invite on this event's account plans, with their owners and outreach status. ?candidate=<id>
// opens that candidate's invitation plan in a panel over the list.
async function Candidates({ params, searchParams }: Pick<Props, "params" | "searchParams">) {
  const { eventId } = await params;
  const open = (await searchParams).candidate;
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
        qualified: qualifyContact(s, contact, brief),
        outreach: progress(brief.sequence, x),
        started: !!x.started_at,
      };
    })
    .sort((a, b) => a.account.name.localeCompare(b.account.name) || a.contact.last_name.localeCompare(b.contact.last_name));

  return (
    <>
      <EventHeader event={event} page="Candidates" />
      <Page>
        <RemoveSelection>
          <Section
            aside={<RemoveSelected campaignId={event.campaign_id} candidates={selected.map(({ contact: c, started }) => ({ id: c.id, name: `${c.first_name} ${c.last_name}`, started }))} />}
            title="Selected Executives"
            description={<>Everyone selected to invite on this event’s <Link href={`/events/${event.slug}/accounts`} className="text-blue-900 hover:underline">account plans</Link>. Outreach: {brief.outreach_lead === "ae" ? "AE-led, BDRs optional" : "Assign BDRs for outreach."}.</>}
          >
            {selected.length ? (
              <ul className="material-base divide-y divide-gray-alpha-400">
                {selected.map(({ contact: c, account, bdrId, qualified, outreach, started }) => (
                  <li key={c.id} className={`grid items-start gap-3 px-5 py-4 xl:grid-cols-[minmax(0,1fr)_150px_140px_140px_200px_120px] xl:gap-5 ${c.id === open ? "bg-gray-100" : ""}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <RemoveCheckbox id={c.id} name={`${c.first_name} ${c.last_name}`} />
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
                      <Link href={`/events/${event.slug}/accounts/${account.id}`} className="font-medium hover:underline">{account.name}</Link>
                    </div>
                    <div className="text-label-13">
                      <p className="text-label-12 text-gray-900">AE</p>
                      {/* The AE is the account's Salesforce owner: assignable here only while the account has none. */}
                      {account.owner_id ? aes.find((u) => u.id === account.owner_id)?.name : <Assign label="AE" options={aes} value={null} action={assignAe.bind(null, account.id)} />}
                    </div>
                    <div className="text-label-13">
                      <p className="text-label-12 text-gray-900">BDR</p>
                      {brief.outreach_lead === "ae" ? (
                        <p className="text-gray-900">Not needed for event</p>
                      ) : started ? (
                        bdrs.find((u) => u.id === bdrId)?.name
                      ) : (
                        <Assign label="BDR" options={bdrs} value={bdrId} action={assignBdr.bind(null, event.campaign_id, c.id)} />
                      )}
                    </div>
                    <div className="space-y-1.5 text-label-12">
                      <Status color={outreach.color}><span className="text-label-12">{outreach.text}</span></Status>
                    </div>
                    <div className="flex flex-col items-start gap-2 xl:justify-self-end">
                      <Link href={`?candidate=${c.id}`} scroll={false} className="whitespace-nowrap text-label-13 font-medium text-blue-900 hover:underline">Invitation Plan →</Link>
                      {!c.email && c.linkedin_url && !c.linkedin_url.includes("linkedin.example") && <FindEmail contactId={c.id} />}
                      {c.email && !started && <StartSequence campaignId={event.campaign_id} contactId={c.id} />}
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
        </RemoveSelection>
      </Page>
      {typeof open === "string" && <CandidatePanel s={s} event={brief} contactId={open} close={`/events/${event.slug}/candidates`} />}
    </>
  );
}
