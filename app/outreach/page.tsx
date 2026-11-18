import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { Avatar, Button, Page, PageHeader, Section, Status, TabLinks } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { myQueue } from "@/lib/outreach";
import { formatDate } from "@/lib/derive";
import { daysUntil, OUTREACH_URL, shortDate } from "@/lib/sequence";

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
  const { due, replies, toSelect, toStart, stats } = myQueue(s, me.id);
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
      </PageHeader>
      <Page>
        {stats.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stats.map(({ e, accounts, emails, accepted }) => (
              <li key={e.campaign_id} className="material-base p-4">
                <Link href={`/events/${e.slug}`} className="text-label-14 font-medium hover:underline">{e.short_name}</Link>
                <dl className="mt-3 grid grid-cols-3 gap-3">
                  {[["Accounts", accounts], ["Emails Sent", emails], ["Accepted", accepted]].map(([label, n]) => (
                    <div key={label}>
                      <dt className="text-label-12 text-gray-900">{label}</dt>
                      <dd className="text-heading-24 tabular-nums">{n}</dd>
                    </div>
                  ))}
                </dl>
              </li>
            ))}
          </ul>
        )}

<Section title="Accounts to Select Candidates">
          {toSelect.length ? (
            <div className="space-y-6">
              {toSelect.map(({ e, accounts }) => {
                const left = e.select_by === null ? null : daysUntil(e.select_by);
                return (
                  <div key={e.campaign_id} className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                      <h3 className="text-label-14 font-medium">{e.short_name} · {accounts.length} {accounts.length === 1 ? "account" : "accounts"}</h3>
                      {left === null ? (
                        <Status color="gray">No selection deadline</Status>
                      ) : (
                        <Status color={left < 0 ? "red" : left <= 3 ? "amber" : "gray"}>
                          Select by {formatDate(e.select_by!)} · {left < 0 ? "deadline passed" : left === 0 ? "today" : `${left} ${left === 1 ? "day" : "days"} left`}
                        </Status>
                      )}
                    </div>
                    <List empty="">
                      {accounts.map((p) => (
                        <Row key={p.account.id}>
                          <div className="min-w-0">
                            <p className="truncate text-label-14 font-medium">{p.account.name}</p>
                            <p className="truncate text-label-12 text-gray-900">{[p.account.icp_tier, p.account.vertical].filter(Boolean).join(" · ")}</p>
                          </div>
                          <span className="text-label-13 text-gray-900">{((n) => `${n} qualified ${n === 1 ? "executive" : "executives"}`)(p.executives.filter((x) => x.status === "Qualified").length)}</span>
                          <Link href={`/events/${e.slug}/accounts/${p.account.id}`} className="justify-self-end text-label-13 font-medium text-blue-900 hover:underline">Contacts →</Link>
                        </Row>
                      ))}
                    </List>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">You’ve selected candidates at every account in your upcoming events.</p>
          )}
        </Section>

        <Section title="Candidates to Start Sequence">
          <List empty="No selected candidates waiting to start.">
            {toStart.map((r) => (
              <Row key={`${r.x.campaign_id}${r.c.id}`}>
                {who(r)}
                <Status color="gray">Not started</Status>
                <Link href={plan(r.e.slug, r.c.id)} className="justify-self-end text-label-13 font-medium text-blue-900 hover:underline">Open Plan →</Link>
              </Row>
            ))}
          </List>
        </Section>

        <Section title="Due Now">
          <List empty="Nothing due. Slack pings you at 9am when a step falls due.">
            {due.map((r) => (
              <Row key={`${r.x.campaign_id}${r.c.id}${r.step.index}`}>
                {who(r)}
                <div className="space-y-1">
                  <Status color={r.step.status === "Overdue" ? "red" : "amber"}>
                    Step {r.step.index + 1} · {r.step.step.channel} · {r.step.status === "Overdue" ? `overdue since ${shortDate(r.step.due!)}` : "due today"}
                  </Status>
                  {r.more > 0 && <p className="pl-3.5 text-label-12 text-gray-900">+{r.more} more {r.more === 1 ? "step" : "steps"} due after this</p>}
                </div>
                <div className="flex flex-wrap items-start justify-end gap-2">
                  <Link href={plan(r.e.slug, r.c.id, r.step.index)} className="flex h-8 items-center text-label-13 text-blue-900 hover:underline">View Draft</Link>
                  <Button href={OUTREACH_URL}>Open in Outreach</Button>
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
