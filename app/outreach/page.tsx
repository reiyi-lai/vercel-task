import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Avatar, Button, Page, PageHeader, Section, Status, TabLinks } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { myQueue } from "@/lib/outreach";
import { gmailDraft, shortDate } from "@/lib/sequence";
import StartSequence from "../events/[eventId]/candidates/start-sequence";
import MarkSent from "./mark-sent";

export const metadata: Metadata = { title: "For AE/BDR" };

export default function OutreachPage({ searchParams }: PageProps<"/outreach">) {
  return <Suspense fallback={<p className="p-10 text-copy-14 text-gray-900">Loading…</p>}><Queue searchParams={searchParams} /></Suspense>;
}

// The AE's or BDR's working list across every event, the same steps Slack pings them about. ?as=<user id> picks whose
// queue; in production, it would be whoever is signed in.
async function Queue({ searchParams }: Pick<PageProps<"/outreach">, "searchParams">) {
  await connection(); // what's due depends on today's date
  const s = await loadSnapshot();
  const sellers = s.users.filter((u) => u.title === "Account Executive" || u.title === "BDR");
  const as = (await searchParams).as;
  const me = sellers.find((u) => u.id === as) ?? sellers[0];
  const { due, replies, toStart } = myQueue(s, me.id);
  const plan = (slug: string, contactId: string, step?: number) => `/events/${slug}/candidates/${contactId}${step === undefined ? "" : `#step-${step + 1}`}`;
  const who = (r: { c: { first_name: string; last_name: string; title: string | null }; account: string; e: { short_name: string } }) => (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={`${r.c.first_name} ${r.c.last_name}`} />
      <div className="min-w-0">
        <p className="truncate text-label-14 font-medium">{r.c.first_name} {r.c.last_name}</p>
        <p className="truncate text-label-12 text-gray-900">{r.c.title} · {r.account} · {r.e.short_name}</p>
      </div>
    </div>
  );

  return (
    <>
      <PageHeader
        tabs={
          <div className="flex flex-wrap items-center gap-3 pb-5">
            <span className="text-label-13 text-gray-900">Viewing as</span>
            <TabLinks variant="segmented" items={sellers.map((u) => ({ label: `${u.first_name} ${u.last_name} · ${u.title === "BDR" ? "BDR" : "AE"}`, href: `/outreach?as=${u.id}`, active: u.id === me.id }))} />
          </div>
        }
      >
        <h1 className="text-heading-32">For AE/BDR</h1>
        <p className="mt-1 text-copy-14 text-gray-900">{me.first_name}’s steps due across every event, replies to answer, and candidates waiting to start.</p>
      </PageHeader>
      <Page>
        <Section title="Due Now" description="Send each from Gmail or LinkedIn, then mark it sent.">
          <List empty="Nothing due. Slack pings you at 9am and 4pm when a step falls due.">
            {due.map((r) => (
              <Row key={`${r.x.campaign_id}${r.c.id}${r.step.index}`}>
                {who(r)}
                <Status color={r.step.status === "Overdue" ? "red" : "amber"}>
                  Step {r.step.index + 1} · {r.step.step.channel} · {r.step.status === "Overdue" ? `overdue since ${shortDate(r.step.due!)}` : "due today"}
                </Status>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  <Link href={plan(r.e.slug, r.c.id, r.step.index)} className="flex h-8 items-center text-label-13 text-blue-900 hover:underline">View Draft</Link>
                  {r.step.step.channel === "Email" && r.c.email && <Button href={gmailDraft(r.c.email, r.copy.subject, r.copy.body)}>Open in Gmail</Button>}
                  <MarkSent campaignId={r.x.campaign_id} contactId={r.c.id} step={r.step.index} />
                </div>
              </Row>
            ))}
          </List>
        </Section>

        <Section title="Ready to Start" description="Your candidates whose outreach hasn’t started.">
          <List empty="Every candidate of yours has started.">
            {toStart.map((r) => (
              <Row key={`${r.x.campaign_id}${r.c.id}`}>
                {who(r)}
                <Status color="gray">Not started</Status>
                <div className="flex flex-wrap items-start justify-end gap-3">
                  <Link href={plan(r.e.slug, r.c.id)} className="flex h-8 items-center text-label-13 text-blue-900 hover:underline">Open Plan</Link>
                  {r.c.email ? <StartSequence campaignId={r.x.campaign_id} contactId={r.c.id} /> : <span className="flex h-8 items-center text-label-13 text-gray-900">Needs an email</span>}
                </div>
              </Row>
            ))}
          </List>
        </Section>

        <Section title="Replies to Answer" description="Answer within a day, then mark them Accepted or Declined on their plan.">
          <List empty="No replies waiting.">
            {replies.map((r) => (
              <Row key={`${r.x.campaign_id}${r.c.id}`}>
                {who(r)}
                <Status color="blue">Replied</Status>
                <Link href={plan(r.e.slug, r.c.id)} className="justify-self-end text-label-13 font-medium text-blue-900 hover:underline">Open Plan →</Link>
              </Row>
            ))}
          </List>
        </Section>
      </Page>
    </>
  );
}

function List({ empty, children }: { empty: string; children: ReactNode[] }) {
  return children.length ? (
    <ul className="material-base divide-y divide-gray-alpha-400">{children}</ul>
  ) : (
    <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">{empty}</p>
  );
}

const Row = ({ children }: { children: ReactNode }) => (
  <li className="grid items-center gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_260px_minmax(0,auto)] md:gap-6">{children}</li>
);
