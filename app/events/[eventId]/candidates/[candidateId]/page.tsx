import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import ParamSwitch from "@/components/param-switch";
import { Avatar, Badge, Button, Page, PageHeader, Section, Status, Tags, type DotColor } from "@/components/ui";
import { loadSnapshot } from "@/lib/data";
import { accountInteractions, derivePlan, drafts, eventOverview, formatDate, vercelUsage, type Connector, type Rung } from "@/lib/derive";
import { ROUTES, type Strength } from "@/lib/rules";
import AskInSlack from "./ask-in-slack";
import Drafts, { draftKey } from "./drafts";

type Props = PageProps<"/events/[eventId]/candidates/[candidateId]">;

const strengthDot: Record<Strength, DotColor> = { Strong: "green", Moderate: "amber", Weak: "gray" };
const strengthRules = {
  Strong: ["Warm connection confirmed via Slack (via Existing customer, Vercel leadership, or Current attendee)", "Salesforce meeting or reply ≤12 mths (via AE / deal team)"],
  Moderate: ["Warm connection at same company for >1 mth via The Swarm", "Salesforce meeting or reply within last 12–24 mths"],
};
const edge = { Strong: "border-t-2 border-gray-1000", Moderate: "border-t border-gray-700", Weak: "border-t border-dashed border-gray-600" };
const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const muted = (c: Connector) => ["Paused", "Held", "Weak", "Not a route"].includes(c.role);
const interactionDot = { Current: "green", Former: "gray" } as const;

// A row's next step: every connector is asked in Slack first, then the answer decides the action or why there is none.
function nextStep(c: Connector, rung?: Rung): { button: string } | { note: string } {
  if (!c.confirmation) return { button: "Ask in Slack" };
  if (c.confirmation.pending) return { note: "Awaiting Reply" };
  if (rung) return { button: rung.route === ROUTES.ae || rung.route === ROUTES.levelZero ? "Send Invite" : "Request Intro" };
  if (c.held) return { note: "On Hold" };
  if (c.role === "Paused") return { note: `Paused Until ${formatDate(c.pausedUntil!).replace(/, \d{4}$/, "")}` };
  return { note: c.role === "Seating" ? "Seat Together" : "Not Recommended" };
}

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
  const s = await loadSnapshot();
  const overview = eventOverview(s, eventId);
  if (!overview || !s.contacts.some((c) => c.id === candidateId)) notFound();
  const { event } = overview;
  const plan = derivePlan(s, candidateId, event.campaign_id);
  const { target, targetOwner, account, ladder } = plan;
  const name = `${target.first_name} ${target.last_name}`;
  const { connectors } = plan;
  const basePath = `/events/${event.slug}/candidates/${candidateId}`;
  const usage = vercelUsage(s, plan.account.id);
  const planDrafts = drafts(plan, event.name, event.date, usage.activeUsers);
  const topVercel = usage.teams[0];
  const interactions = accountInteractions(s, target);

  return (
    <>
      <PageHeader
        crumbs={[{ label: "All Events" }, { label: event.short_name, href: `/events/${event.slug}` }, { label: "Candidates" }, { label: name }]}
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
        <Section title="Recommended Route">
          <ol className="material-base divide-y divide-gray-alpha-400 overflow-hidden">
            {ladder.map(({ connector: c, route, label }, i) => (
              <li key={c.ref} className={`grid items-center gap-3 px-5 py-4 sm:grid-cols-[32px_260px_1fr_auto] sm:gap-6 ${i === 0 ? "bg-blue-100" : ""}`}>
                <span className={`flex size-7 items-center justify-center rounded-full text-label-13 ${i === 0 ? "bg-blue-700 text-white" : "bg-gray-100"}`}>{i + 1}</span>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="inverted">{route}</Badge>
                  <Badge variant={i === 0 ? "blue" : "gray"}>{label}</Badge>
                </div>
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={c.name} />
                  <div className="min-w-0">
                    <p className="text-label-14 font-medium">{c.name}</p>
                    <p className="text-label-12 text-gray-900">{c.title}{c.asker && ` · ask sent by ${c.asker}`}</p>
                  </div>
                </div>
                {c.strength ? <Status color={strengthDot[c.strength]}>{c.strength}</Status> : <Status color="hollow">No direct tie</Status>}
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Relationship Map">
          <div className="mb-4 rounded-xl bg-gray-100 p-4 text-copy-13 text-gray-900">
            <p><strong className="text-gray-1000">How strength is scored</strong></p>
            {Object.entries(strengthRules).map(([strength, rules]) => (
              <div key={strength} className="mt-2 pl-2">
                <p className="text-gray-1000">{strength}</p>
                <ul className="mt-0.5 list-disc space-y-0.5 pl-5">
                  {rules.map((r) => <li key={r}>{r}</li>)}
                </ul>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto">
            <div className="grid min-w-[900px] grid-cols-[300px_64px_1fr]">
              <div className="rounded-xl bg-gray-100 p-4">
                <p className="mb-3 text-label-12 font-medium uppercase tracking-wide text-gray-900">Who knows {target.first_name}</p>
                <div className="space-y-2 border-r border-gray-700">
                  {connectors.map((c) => (
                    <div key={c.ref} className={`flex items-center ${muted(c) ? "opacity-50" : ""}`}>
                      <div className={`flex-1 rounded-lg px-3 py-2 ${c.role === "Primary" ? "border-2 border-blue-700 bg-background-100" : c.strength ? "bg-background-100 shadow-border" : "border border-dashed border-gray-alpha-500 bg-background-100"}`}>
                        <p className="text-label-13"><strong>{c.name}</strong> · {(c.strength ?? "no direct tie").toLowerCase()}</p>
                        <p className="text-label-12 text-gray-900">{c.routes.join(" + ")}</p>
                      </div>
                      <span aria-hidden className={`w-4 ${c.role === "Primary" ? "border-t-2 border-blue-700" : edge[c.strength ?? "Weak"]}`} />
                    </div>
                  ))}
                </div>
              </div>

              <div aria-hidden className="flex items-center">
                <span className="flex-1 border-t border-gray-700" />
                <span className="size-0 border-y-[5px] border-l-[7px] border-y-transparent border-l-gray-700" />
              </div>

              <div className="relative grid grid-rows-[1fr_auto_1fr] rounded-xl bg-blue-100 px-6 pb-6 pt-12">
                <p className="absolute left-5 top-4 text-label-12 font-medium uppercase tracking-wide text-blue-900">{account.name}</p>
                <div className="row-start-2 flex items-center">
                  <div className="w-56 shrink-0 rounded-lg bg-blue-700 px-4 py-3 text-white">
                    <p className="text-label-14 font-semibold">{name}</p>
                    <p className="text-label-12 text-white/80">{target.title}</p>
                  </div>
                  {topVercel && (
                    <>
                      <div className="flex w-36 shrink-0 flex-col items-center">
                        <span className="text-label-12 text-gray-900">top Vercel team</span>
                        <span aria-hidden className="w-full border-t border-gray-700" />
                        <span className="h-4" />
                      </div>
                      <div className="rounded-lg bg-background-100 px-4 py-3 shadow-border">
                        <p className="text-label-14 font-medium">{topVercel.key_contact_name}</p>
                        <p className="text-label-12 text-gray-900">{topVercel.key_contact_title}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-3 flex gap-6 text-label-12 text-gray-900">
            {(["Strong", "Moderate", "Weak"] as const).map((st) => (
              <span key={st} className="flex items-center gap-2"><span aria-hidden className={`w-6 ${edge[st]}`} />{st}</span>
            ))}
            <span className="flex items-center gap-2"><span aria-hidden className="w-6 border-t-2 border-blue-700" />Recommended</span>
          </div>

          <div className="material-base mt-6 divide-y divide-gray-alpha-400">
            {connectors.map((c) => {
              const step = nextStep(c, ladder.find((r) => r.connector === c));
              return (
                <div key={c.ref} className="grid items-center gap-3 px-5 py-4 lg:grid-cols-[220px_260px_1fr_140px] lg:gap-6">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0">
                      <p className="text-label-14 font-medium">{c.name}</p>
                      <p className="text-label-12 text-gray-900">{c.title}</p>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap gap-1">
                      {c.routes.map((r) => <Badge key={r} variant="inverted">{r}</Badge>)}
                    </div>
                    {c.strength ? <Status color={strengthDot[c.strength]}>{c.strength}</Status> : c.routes.length > 0 && <Status color="hollow">No direct tie</Status>}
                  </div>
                  <div className="space-y-1.5">
                    {c.evidence.length > 0 && (
                      <ul className="space-y-0.5">
                        {c.evidence.map((e) => (
                          <li key={e.text} className="text-copy-13">
                            {e.text}
                            {e.detail && <p className="mt-1.5 mb-3 text-label-12 italic text-gray-900">“{e.detail}”</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {c.evidence.length > 0 && (
                      <p className="text-label-12 text-gray-900">SOURCES: {[...new Set(c.evidence.map((e) => e.source))].join(" · ")}</p>
                    )}
                    <Status color={!c.confirmation ? "hollow" : c.confirmation.pending ? "amber" : "green"}>
                      <span className="inline-flex items-center gap-1.5 text-label-12"><Image src="/slack.webp" alt="Slack" width={18} height={18} className="ml-1" />{c.confirmation?.text ?? "Not asked yet"}</span>
                    </Status>
                    {c.load && (
                      <p className={`text-label-12 ${c.pausedUntil ? "text-amber-900" : "text-gray-900"}`}>
                        Intro Asks Used: {c.load.used} of {c.load.cap}{c.pausedUntil && ` · paused until ${formatDate(c.pausedUntil)}`}
                      </p>
                    )}
                  </div>
                  <div className="flex lg:justify-end">
                    {"button" in step && step.button === "Ask in Slack" ? (
                      <AskInSlack name={c.name} primary={c === ladder[0].connector} drafts={drafts(plan, event.name, event.date, usage.activeUsers, c).filter((d) => d.tab !== "Fallback: Direct")} />
                    ) : "button" in step ? (
                      <Button variant={c === ladder[0].connector ? "primary" : "secondary"}>{step.button}</Button>
                    ) : (
                      <span className="text-label-13 text-gray-700">{step.note}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

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

        <ParamSwitch
          name="draft"
          views={Object.fromEntries(planDrafts.map((d, i) => [draftKey(d), <Drafts key={i} drafts={planDrafts} active={i} basePath={basePath} />]))}
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
