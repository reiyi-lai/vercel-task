import type { Activity, Contact, Snapshot, SwarmSource, User } from "./data";
import {
  ACTIVITY_MONTHS, ANSWER_HOLD, ANSWER_STRENGTH, AS_OF, LEADERSHIP_TITLES, ROUTE_PRECEDENCE, ROUTES, STRENGTH_RANK, TIE_ORDER,
  type Route, type Strength,
} from "./rules";

export type Role = "Primary" | "Backup" | "Seating" | "Paused" | "Held" | "Weak" | "Owner" | "Not a route";
export type Evidence = { text: string; source: string; detail?: string };
export type Connector = {
  ref: string; // user:<id> | contact:<id> | ext:<linkedin url>
  name: string;
  title: string;
  routes: Route[];
  strength?: Strength;
  role: Role;
  evidence: Evidence[];
  confirmation?: { text: string; pending: boolean };
  asker?: string; // who sends the ask (a customer's own AE)
  relationship?: string; // how they know the target, for drafts
  load?: { used: number; cap: number };
  pausedUntil?: string;
  held?: boolean;
  confirmedKnowWell?: boolean;
};
export type Rung = { connector: Connector; route: Route; label: string };

const ROLE_ORDER: Role[] = ["Primary", "Backup", "Seating", "Paused", "Held", "Owner", "Weak", "Not a route"];

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;
const first = (name: string) => name.split(" ")[0];
const plural = (n: number, word: string, words = `${word}s`) => `${n} ${n === 1 ? word : words}`;
const months = (iso: string) => {
  const d = new Date(iso);
  return (AS_OF.getUTCFullYear() - d.getUTCFullYear()) * 12 + AS_OF.getUTCMonth() - d.getUTCMonth();
};
export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const primaryRoute = (c: Connector) => ROUTE_PRECEDENCE.find((r) => c.routes.includes(r))!;

// Summarises Salesforce activity (Tasks and Events): two-way (a meeting, call or reply) sets the strength by recency; outbound-only is weak.
function activity(list: Activity[]): { strength: Strength; text: string; source: string } {
  const meetings = list.filter((e) => e.subtype !== "Email").length;
  const replies = list.filter((e) => e.direction === "Inbound").length;
  const outbound = list.length - meetings - replies;
  const last = list.map((e) => e.occurred_at).sort().at(-1)!;
  const age = months(last);
  const strength: Strength = meetings + replies === 0 ? "Weak" : age <= ACTIVITY_MONTHS.strong ? "Strong" : age <= ACTIVITY_MONTHS.moderate ? "Moderate" : "Weak";
  const parts = [meetings && plural(meetings, "meeting"), replies && plural(replies, "email reply", "email replies"), outbound && plural(outbound, "outbound email")];
  const source = `Salesforce (${[...new Set(list.map((e) => e.source))].join(", ")})`;
  return { strength, text: `Salesforce (latest ${new Date(last).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric", timeZone: "UTC" })}): ${parts.filter(Boolean).join(", ")}`, source };
}

function sourceStrength(x: SwarmSource): Strength {
  if (x.origin === "work_overlap") return x.closeness === "same_team" || x.closeness === "reporting_line" ? "Strong" : "Moderate";
  return x.origin === "shared_org" ? "Moderate" : "Weak";
}

// One line per Swarm source, built from its fixed fields, e.g. "Same Company: Visa, 2013–2014".
function sourceText(x: SwarmSource) {
  if (x.origin === "linkedin_connection") return "1st-degree connection";
  return `Same Company: ${x.shared_company}, ${x.overlap_start_date!.slice(0, 4)}–${x.overlap_end_date?.slice(0, 4) ?? "present"}`;
}

function relationship(x: SwarmSource) {
  if (x.origin === "work_overlap") return `worked together at ${x.shared_company!.replace(/\.$/, "")}`;
  if (x.origin === "shared_org") return `know each other through the ${x.shared_company}`;
  return "know each other";
}

// The opportunity roles a contact has played (e.g. Champion), with each opportunity.
const opportunityRoles = (s: Snapshot, contactId: string) =>
  s.opportunity_contact_roles.filter((r) => r.contact_id === contactId).map((r) => ({ role: r.role, opp: s.opportunities.find((o) => o.id === r.opportunity_id)! }));

export function lookups(s: Snapshot) {
  const user = new Map(s.users.map((u) => [u.id, u]));
  const contact = new Map(s.contacts.map((c) => [c.id, c]));
  const account = new Map(s.accounts.map((a) => [a.id, a]));
  const isCustomer = (accountId: string | null) =>
    account.get(accountId!)?.type === "Customer" || s.opportunities.some((o) => o.account_id === accountId && o.is_won);
  return { user, contact, account, isCustomer };
}

export function derivePlan(s: Snapshot, targetId: string, campaignId: string) {
  const { user, contact, account, isCustomer } = lookups(s);
  const target = contact.get(targetId)!;
  const targetOwner = user.get(target.owner_id!)!;
  const levelZero = isCustomer(target.account_id);
  const attendees = new Set(s.campaign_members.filter((m) => m.campaign_id === campaignId && m.invite_status === "Confirmed").map((m) => m.contact_id));
  const candidates = new Set(s.clay_enrichments.filter((e) => e.campaign_id === campaignId).map((e) => e.contact_id));
  const conns = new Map<string, Connector>();

  const bump = (c: Connector, strength: Strength, evidence: Evidence) => {
    c.evidence.push(evidence);
    if (!c.strength || STRENGTH_RANK[strength] > STRENGTH_RANK[c.strength]) c.strength = strength;
  };
  const addRoute = (c: Connector, route: Route) => !c.routes.includes(route) && c.routes.push(route);
  const fromUser = (u: User) => {
    const ref = `user:${u.id}`;
    if (!conns.has(ref)) conns.set(ref, { ref, name: fullName(u), title: `${u.title} · Vercel`, routes: [], role: "Weak", evidence: [] });
    const c = conns.get(ref)!;
    addRoute(c, LEADERSHIP_TITLES.includes(u.title ?? "") ? ROUTES.leadership : ROUTES.ae);
    return c;
  };
  const fromContact = (k: Contact) => {
    const ref = `contact:${k.id}`;
    if (!conns.has(ref)) {
      const org = account.get(k.account_id!)?.name;
      conns.set(ref, {
        ref, name: fullName(k), title: [k.title, org].filter(Boolean).join(" · "),
        routes: [], role: "Not a route", evidence: [],
      });
    }
    return conns.get(ref)!;
  };

  // 1. The target's AE is always a path; Salesforce activity between Vercel users and the target sets their strength.
  fromUser(targetOwner);
  const byUser = Map.groupBy(s.activities.filter((e) => e.contact_id === targetId && e.owner_id), (e) => e.owner_id!);
  for (const [userId, list] of byUser) {
    const { strength, text, source } = activity(list);
    bump(fromUser(user.get(userId)!), strength, { text, source });
  }
  if (!byUser.has(targetOwner.id)) conns.get(`user:${targetOwner.id}`)!.evidence.push({ text: `No activity with ${target.first_name} in Salesforce`, source: "Salesforce" });

  // 2. TeamLink: LinkedIn 1st-degree connections of Vercel employees (weak on their own).
  for (const t of s.teamlink_connections.filter((t) => t.contact_id === targetId)) {
    bump(fromUser(user.get(t.user_id)!), "Weak", { text: "LinkedIn 1st-degree connection", source: `TeamLink (${t.seat_type})` });
  }

  // 3. Clay / The Swarm warm paths. Vercel people match users by name (users has no LinkedIn URL); others match contacts by LinkedIn URL.
  const connections = s.clay_enrichments.find((e) => e.contact_id === targetId && e.campaign_id === campaignId)?.warm_intro_paths.connections ?? [];
  for (const p of connections) {
    const evidence = (x: SwarmSource) => ({ text: sourceText(x), source: "Clay (The Swarm)", detail: x.detail });
    if (p.connector_current_company_name === "Vercel") {
      const c = fromUser(s.users.find((u) => fullName(u) === p.connector_name)!);
      for (const x of p.sources) if (x.origin !== "linkedin_connection" || !c.evidence.some((e) => e.text.startsWith("LinkedIn"))) bump(c, sourceStrength(x), evidence(x));
      continue;
    }
    const k = s.contacts.find((x) => x.linkedin_url === p.connector_linkedin_url);
    if (!k) {
      const ref = `ext:${p.connector_linkedin_url}`;
      conns.set(ref, { ref, name: p.connector_name, title: p.connector_current_company_name, routes: [], role: "Not a route", evidence: p.sources.map((x) => ({ ...evidence(x), text: `${sourceText(x)} (not in Salesforce)` })) });
      continue;
    }
    const c = fromContact(k);
    for (const x of p.sources) bump(c, sourceStrength(x), evidence(x));
    c.relationship = relationship(p.sources[0]);
    if (isCustomer(k.account_id) && k.intro_program === "Opted in") {
      addRoute(c, ROUTES.customer);
      const customerAe = user.get(k.owner_id!)!;
      c.asker = fullName(customerAe);
      // A customer path is only as good as the customer's AE relationship: no two-way activity in 12 months caps it at Moderate.
      const aeActivity = s.activities.filter((e) => e.contact_id === k.id && e.owner_id === customerAe.id);
      if (c.strength === "Strong" && (!aeActivity.length || activity(aeActivity).strength !== "Strong")) {
        c.strength = "Moderate";
        c.evidence.push({ text: `${c.asker} has no recent two-way activity with ${first(c.name)}`, source: "Salesforce" });
      }
    }
    if (attendees.has(k.id)) addRoute(c, ROUTES.attendee);
    if (candidates.has(k.id)) c.evidence.push({ text: "A candidate for this event too, so revisit once they accept", source: "Seatbook" });
  }

  // 4. Slack confirmations override inferred strength.
  for (const a of s.connector_confirmations.filter((a) => a.target_contact_id === targetId && conns.has(a.connector_ref))) {
    const c = conns.get(a.connector_ref)!;
    if (!a.answer) {
      c.confirmation = { text: `Asked ${a.asked_to} · no answer yet`, pending: true };
      continue;
    }
    c.confirmation = { text: `${a.answered_by}: “${a.answer}” · ${a.method === "slack_channel" ? `${a.asked_to} · ` : ""}${formatDate(a.answered_at!)}`, pending: false };
    if (a.answer === ANSWER_HOLD) c.held = true;
    if (ANSWER_STRENGTH[a.answer]) c.strength = ANSWER_STRENGTH[a.answer];
    if (a.answer === "Know well") c.confirmedKnowWell = true;
  }

  // 5. Intro capacity: connectors at their monthly cap are paused, not dropped.
  for (const c of conns.values()) {
    const load = s.connector_load.find((l) => l.connector_name === c.name);
    if (!load) continue;
    c.load = { used: load.used, cap: load.monthly_cap };
    if (load.used >= load.monthly_cap) c.pausedUntil = load.resets!;
  }

  // 6. Roles, then rank the usable paths: strength first, then the tie order.
  const ownerConn = conns.get(`user:${targetOwner.id}`)!;
  if (levelZero) ownerConn.routes = [ROUTES.levelZero];
  const usable: Connector[] = [];
  for (const c of conns.values()) {
    c.role =
      !c.routes.length ? "Not a route"
      : c.held ? "Held"
      : !c.strength || c.strength === "Weak" ? (c === ownerConn ? "Owner" : "Weak")
      : c.routes.length === 1 && c.routes[0] === ROUTES.attendee && !c.confirmedKnowWell ? "Seating"
      : c.pausedUntil ? "Paused"
      : "Backup";
    if (c.role === "Backup") usable.push(c);
  }
  usable.sort((a, b) => STRENGTH_RANK[b.strength!] - STRENGTH_RANK[a.strength!] || TIE_ORDER.indexOf(primaryRoute(a)) - TIE_ORDER.indexOf(primaryRoute(b)));
  if (levelZero) usable.splice(0, usable.length, ownerConn, ...usable.filter((c) => c !== ownerConn));
  if (usable[0]) usable[0].role = "Primary";

  // The ladder: usable paths in order, then the AE's direct invite as the fallback.
  const ladder: Rung[] = usable.map((c, i) => ({ connector: c, route: primaryRoute(c), label: i === 0 ? "Recommended" : "Backup" }));
  if (!usable.includes(ownerConn)) ladder.push({ connector: ownerConn, route: ROUTES.ae, label: ladder.length ? "Fallback: direct" : "Recommended" });

  const connectors = [...conns.values()].sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  return { target, targetOwner, account: account.get(target.account_id!)!, levelZero, connectors, ladder };
}

export type Plan = ReturnType<typeof derivePlan>;

// Template drafts built from the plan (no LLM yet): the ask to the connector, the blurb they forward, and the AE's direct invite.
// Drafts for asking one connector; the top of the ladder by default.
export function drafts(plan: Plan, eventName: string, date: string, activeUsers: number, c = plan.ladder[0].connector) {
  const { target, targetOwner, account, ladder } = plan;
  const ae = fullName(targetOwner);
  const direct = {
    tab: "Fallback: Direct",
    meta: `From ${ae} → ${fullName(target)}${ladder.length > 1 ? " · sent if the warm path stalls" : ""}`,
    body: `Hi ${target.first_name} — I'm ${first(ae)}, Vercel's account lead for ${account.name}.${activeUsers ? ` ${activeUsers} of your engineers already build on Vercel, so I thought you'd value the conversation.` : ""}\n\nWe're hosting a small group of technology leaders at ${eventName} on ${date}. Would you like to join us?\n\n— ${first(ae)}`,
    approve: ladder.length > 1 ? "Approve as Fallback" : "Approve & Send",
  };
  if (c.ref === `user:${targetOwner.id}`) return [{ ...direct, tab: "Direct Invite" }];

  const asker = c.asker ?? ae;
  return [
    {
      tab: "To Connector",
      meta: `From ${asker} → ${c.name}${c.asker ? ` · by email, ${ae} cc'd` : " · Slack DM"}`,
      body: `Hi ${first(c.name)} — quick favor. ${fullName(target)} (${target.title}, ${account.name}) is on our list for ${eventName} on ${date}, and I believe you two ${c.relationship ?? "know each other"}. Would you be open to forwarding the short note below? Totally fine if the timing isn't right.\n\n— ${first(asker)}`,
      approve: `Approve & Send to ${first(asker)}`,
    },
    {
      tab: "Blurb to Forward",
      meta: `${c.name} forwards this to ${target.first_name}`,
      body: `${target.first_name} — Vercel is hosting a small group of technology leaders at ${eventName} on ${date}.${c.routes.includes(ROUTES.attendee) ? " I'll be there and thought you'd enjoy it." : ""} Happy to connect you with ${ae}, who's hosting.`,
      approve: `Approve & Send to ${first(asker)}`,
    },
    direct,
  ];
}

// Past Account Interactions: others at the target's account whom Vercel has emailed, met or had on an opportunity.
// Context for the AE's invite, not a route.
export function accountInteractions(s: Snapshot, target: Contact) {
  return s.contacts.filter((k) => k.account_id === target.account_id && k.id !== target.id).flatMap((k) => {
    const acts = s.activities.filter((e) => e.contact_id === k.id);
    const roles = opportunityRoles(s, k.id);
    if (!acts.length && !roles.length) return [];
    const lines: Evidence[] = roles.map((r) => ({ text: `${r.role} on “${r.opp.name}” · ${r.opp.stage}`, source: "Salesforce opportunities" }));
    if (acts.length) {
      const { text, source } = activity(acts);
      lines.unshift({ text, source });
    }
    return [{ contact: k, name: fullName(k), status: k.employment_status === "Former" ? ("Former" as const) : ("Current" as const), lines }];
  });
}

// An account's Vercel teams with their key contacts, highest spend first.
export function vercelUsage(s: Snapshot, accountId: string) {
  const teams = s.vercel_teams.filter((t) => t.account_id === accountId).sort((a, b) => (b.monthly_spend ?? 0) - (a.monthly_spend ?? 0));
  const sum = (key: "active_users_30d" | "monthly_spend") => teams.reduce((n, t) => n + (t[key] ?? 0), 0);
  return { teams, activeUsers: sum("active_users_30d"), monthlySpend: sum("monthly_spend") };
}

// Event overview: the seat grid and the pipeline columns.
export function eventOverview(s: Snapshot, slug: string) {
  const { user, contact, account, isCustomer } = lookups(s);
  const ev = s.events.find((e) => e.slug === slug);
  if (!ev) return null;
  const campaign = s.campaigns.find((c) => c.id === ev.campaign_id)!;
  const parts = s.campaign_members.filter((m) => m.campaign_id === ev.campaign_id);
  const person = (id: string) => {
    const k = contact.get(id)!;
    const a = account.get(k.account_id!)!;
    return { id, name: fullName(k), title: k.title ?? "", company: a.name, vertical: a.vertical ?? "Other", horizontals: a.horizontals, ae: fullName(user.get(k.owner_id!)!) };
  };

  const seats = Array.from({ length: ev.seats }, (_, i) => {
    const p = parts.find((p) => p.seat === i + 1);
    if (!p) return { n: i + 1, status: "Open" as const };
    return { n: i + 1, status: p.invite_status === "Confirmed" ? ("Confirmed" as const) : ("Pending" as const), ...person(p.contact_id) };
  });

  const card = (contactId: string, extra: { route?: string; detail?: string; href?: string }) => ({ ...person(contactId), ...extra });
  const byStatus = (match: (status: string) => boolean) =>
    parts.filter((p) => match(p.invite_status ?? "")).map((p) =>
      card(p.contact_id, { route: isCustomer(contact.get(p.contact_id)!.account_id) ? ROUTES.levelZero : undefined, detail: p.seat ? `Seat ${p.seat}` : p.invite_status!.split(" — ")[1] })
    );
  const candidates = s.clay_enrichments
    .filter((e) => e.campaign_id === ev.campaign_id && !parts.some((p) => p.contact_id === e.contact_id))
    .map((e) => card(e.contact_id, { route: derivePlan(s, e.contact_id, ev.campaign_id).ladder[0].route, href: `/events/${ev.slug}/candidates/${e.contact_id}` }));

  return {
    event: {
      ...ev,
      name: campaign.name,
      date: formatDate(campaign.start_date!),
      daysOut: Math.round((Date.parse(campaign.start_date!) - AS_OF.getTime()) / 86_400_000),
      hosts: ev.host_user_ids.map((id) => `${fullName(user.get(id)!)} (${user.get(id)!.title})`).join(", "),
    },
    seats,
    // Accepted, but not placed yet: who can fill an open seat.
    unseated: parts.filter((p) => p.invite_status === "Confirmed" && !p.seat).map((p) => ({ status: "Confirmed" as const, ...person(p.contact_id) })),
    candidates: candidates.length,
    pipeline: [
      { title: "Plan Ready", dot: "gray" as const, cards: candidates },
      { title: "Intro Requested", dot: "blue" as const, cards: byStatus((st) => st === "Pending — intro requested") },
      { title: "Invite Sent", dot: "amber" as const, cards: byStatus((st) => st === "Pending — invite sent") },
      { title: "Accepted", dot: "green" as const, cards: byStatus((st) => st === "Confirmed") },
      { title: "Declined · Rerouted", dot: "red" as const, cards: byStatus((st) => st.startsWith("Declined")) },
    ],
  };
}
