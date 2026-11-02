import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { loadSnapshot, type Contact, type SequenceStep, type Snapshot } from "./data";
import { eventOverview, vercelUsage } from "./derive";
import { accountPlan, commercialState } from "./qualify";
import { gmailDraft, render, schedule } from "./sequence";
import { notify, quote, type Block } from "./slack";
import { expireFromRoute, ok, write } from "./write";

const fullName = (p: { first_name: string; last_name: string }) => `${p.first_name} ${p.last_name}`;

// Who sends a step: the AE is the contact's owner; the BDR is the sales development rep.
export function sender(s: Snapshot, step: SequenceStep, c: Contact) {
  return s.users.find((u) => (step.sender === "AE" ? u.id === c.owner_id : u.title === "BDR"))!;
}

// The values a step's template fills for one candidate.
export function messageVars(s: Snapshot, campaignId: string, c: Contact, step: SequenceStep) {
  const event = eventOverview(s, s.events.find((e) => e.campaign_id === campaignId)!.slug)!.event;
  const o = s.outreach.find((x) => x.campaign_id === campaignId && x.contact_id === c.id);
  return {
    first_name: c.first_name,
    account: s.accounts.find((a) => a.id === c.account_id)!.name,
    event: event.name,
    date: event.date,
    personal_line: o?.personal_line ?? "{personal_line}",
    sender_first_name: sender(s, step, c).first_name,
    ae_first_name: s.users.find((u) => u.id === c.owner_id)!.first_name,
  };
}

const Line = z.object({
  line: z.string().describe("One opening sentence for the invitation, under 30 words"),
  signal: z.string().describe("The fact from the context the sentence draws on, in a few words"),
});

const LINE_PROMPT = `You write the opening sentence of an invitation from a Vercel account executive to a technology executive, asking them to a small event.

Ground the sentence in one specific fact about their company from the context you're given: a recent initiative, a leadership change, a hiring push, their Vercel or Next.js footprint, or the history with Vercel. Choose the fact that best connects to the event's theme. Write to the executive directly, in plain words: no flattery, no exclamation marks, no claims beyond the context, under 30 words. If the fact is about layoffs or other sensitive news, choose a different one. Don't mention the event or invite them: the next sentence of the message does that.`;

// Drafts a candidate's personalized line with Claude from the account's context, and saves it.
export async function draftLine(campaignId: string, contactId: string) {
  if (!process.env.ANTHROPIC_API_KEY) return "Drafting needs ANTHROPIC_API_KEY.";
  const s = await loadSnapshot();
  const c = s.contacts.find((x) => x.id === contactId);
  const brief = s.event_briefs.find((b) => b.campaign_id === campaignId);
  if (!c || !brief) return "No such candidate or event.";
  const a = s.accounts.find((x) => x.id === c.account_id)!;
  const campaign = s.campaigns.find((x) => x.id === campaignId)!;
  const plan = accountPlan(s, a, brief);
  const usage = vercelUsage(s, a.id);
  const opp = s.opportunities.find((o) => o.account_id === a.id && !o.is_closed);
  const context = [
    `Event: ${campaign.name}. ${brief.purpose}. Themes: ${brief.themes.join(", ")}.`,
    `Executive: ${fullName(c)}, ${c.title} at ${a.name}${a.vertical ? ` (${a.vertical})` : ""}.`,
    `Commercial context: ${commercialState(s, a).label}.${opp ? ` Open opportunity: ${opp.name} (${opp.stage}).` : ""}`,
    usage.teams.length ? `Vercel usage: ${usage.teams.length} teams, ${usage.activeUsers} active users.` : "",
    a.nextjs_job_posts ? `${a.nextjs_job_posts} of their job posts in the last year name Next.js.` : "",
    "Signals:",
    ...plan.signals.map((x) => `- ${x.signal_date}: ${x.title}.${x.detail ? ` ${x.detail}` : ""}`),
  ].filter(Boolean).join("\n");

  return write(async (db) => {
    const res = await new Anthropic().beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: LINE_PROMPT,
      output_config: { effort: "low", format: betaZodOutputFormat(Line) },
      messages: [{ role: "user", content: context }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error("Couldn't draft a line for this executive.");
    ok(
      await db.from("outreach").upsert({ campaign_id: campaignId, contact_id: contactId, personal_line: res.parsed_output.line, line_signal: res.parsed_output.signal })
    );
  }, expireFromRoute);
}

// A step's message for one candidate, filled in from the event's template.
export function draftCopy(s: Snapshot, campaignId: string, c: Contact, index: number) {
  const step = s.event_briefs.find((b) => b.campaign_id === campaignId)!.sequence[index];
  const vars = messageVars(s, campaignId, c, step);
  return { subject: render(step.subject, vars), body: render(step.body, vars) };
}

// Records a step as sent, with the copy that actually went out: the drafted copy unless the sender edited it.
// by: who marked it, when it came from Slack.
export async function recordSent(campaignId: string, contactId: string, index: number, copy?: { subject: string; body: string }, by?: string, expire?: () => void) {
  const s = await loadSnapshot();
  const o = s.outreach.find((x) => x.campaign_id === campaignId && x.contact_id === contactId);
  if (!o?.started_at) return "Start the sequence first.";
  const c = s.contacts.find((x) => x.id === contactId)!;
  const entry = { step: index, at: new Date().toISOString(), ...(copy ?? draftCopy(s, campaignId, c, index)), ...(by && { by }) };
  return write(
    async (db) => ok(await db.from("outreach").update({ sent: [...o.sent.filter((x) => x.step !== index), entry] }).eq("campaign_id", campaignId).eq("contact_id", contactId)),
    expire
  );
}

const siteUrl = () =>
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3100");

// The Slack card for a step that's due: who it's for, the drafted copy, and buttons to mark it sent as drafted, edit it
// to what actually went out, or open it to send: a Gmail draft for email steps, the invitation page otherwise (and when
// the Gmail link would pass Slack's 3,000-character limit for button links). The buttons carry "campaignId|contactId|step".
export function stepCard(s: Snapshot, campaignId: string, c: Contact, index: number, overdue = false) {
  const step = s.event_briefs.find((b) => b.campaign_id === campaignId)!.sequence[index];
  const by = sender(s, step, c);
  const account = s.accounts.find((a) => a.id === c.account_id)!.name;
  const event = s.campaigns.find((x) => x.id === campaignId)!.name;
  const slug = s.events.find((e) => e.campaign_id === campaignId)!.slug;
  const value = `${campaignId}|${c.id}|${index}`;
  const copy = draftCopy(s, campaignId, c, index);
  const gmail = step.channel === "Email" ? gmailDraft(c.email, copy.subject, copy.body) : null;
  const open = gmail && gmail.length <= 3000
    ? { text: "Open in Gmail", url: gmail }
    : { text: "Open in Seatbook", url: `${siteUrl()}/events/${slug}/candidates/${c.id}` };
  const text = `Step ${index + 1} (${step.channel}) to ${fullName(c)}, ${c.title} at ${account}, is ${overdue ? "overdue" : "due today"} · ${event}`;
  const blocks: Block[] = [
    { type: "section", text: { type: "mrkdwn", text: `*For ${fullName(by)}:* ${text}` } },
    { type: "section", text: { type: "mrkdwn", text: quote(copy) } },
    {
      type: "actions",
      elements: [
        { type: "button", style: "primary", text: { type: "plain_text", text: "Mark Sent" }, action_id: "mark_sent", value },
        { type: "button", text: { type: "plain_text", text: "Edit & Mark Sent" }, action_id: "edit_sent", value },
        { type: "button", text: { type: "plain_text", text: open.text }, action_id: "open", url: open.url },
      ],
    },
  ];
  return { recipient: fullName(by), text, blocks };
}

// What the card becomes once the step is marked sent: the copy that went out, and by whom.
export function sentCard(s: Snapshot, campaignId: string, c: Contact, index: number, copy: { subject: string; body: string }, by: string): Block[] {
  const account = s.accounts.find((a) => a.id === c.account_id)!.name;
  return [
    { type: "section", text: { type: "mrkdwn", text: `:white_check_mark: *Step ${index + 1} to ${fullName(c)} (${account}) sent* by ${by}` } },
    { type: "section", text: { type: "mrkdwn", text: quote(copy) } },
  ];
}

// A Slack card for each step due today or overdue in the event, to its sender, sent on demand.
export async function sendReminders(campaignId: string) {
  const s = await loadSnapshot();
  const brief = s.event_briefs.find((b) => b.campaign_id === campaignId);
  if (!brief) return { error: "No such event." };
  const due = s.outreach
    .filter((o) => o.campaign_id === campaignId)
    .flatMap((o) => schedule(brief.sequence, o).filter((x) => x.status === "Due" || x.status === "Overdue").map((x) => ({ o, x })));
  const error = await write(async (db) => {
    for (const { o, x } of due) {
      const card = stepCard(s, campaignId, s.contacts.find((c) => c.id === o.contact_id)!, x.index, x.status === "Overdue");
      await notify(db, { campaign_id: campaignId, contact_id: o.contact_id, recipient: card.recipient, kind: "Due", text: card.text }, card.blocks);
    }
  }, expireFromRoute);
  return { error, sent: due.length };
}
