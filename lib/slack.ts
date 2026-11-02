import { createHmac, timingSafeEqual } from "node:crypto";
import { ok, type Db } from "./write";

// Slack alerts are for exceptions: a step falling due, a reply to handle, an acceptance or decline. Each is saved for the
// in-app feed and, when SLACK_WEBHOOK_URL is set, posted to that channel. Step cards carry buttons (Mark Sent, Edit &
// Mark Sent) that Slack sends back to /api/slack/interactions; those need the app's Interactivity turned on, its
// SLACK_SIGNING_SECRET, and a SLACK_BOT_TOKEN to open the edit form. Production would DM each AE or BDR instead.

type Alert = { campaign_id: string; contact_id: string | null; recipient: string; kind: string; text: string };
export type Block = Record<string, unknown>;

export async function notify(db: Db, alert: Alert, blocks?: Block[]) {
  const url = process.env.SLACK_WEBHOOK_URL;
  const body = { text: `For ${alert.recipient}: ${alert.text}`, blocks: blocks ?? [{ type: "section", text: { type: "mrkdwn", text: `*For ${alert.recipient}:* ${alert.text}` } }] };
  const posted = !!url && (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.ok, () => false));
  ok(await db.from("slack_alerts").insert({ ...alert, posted }));
}

// Slack's request signature (signing secret, timestamp and raw body), rejecting anything older than five minutes.
export function verifySlack(rawBody: string, headers: Headers) {
  const secret = process.env.SLACK_SIGNING_SECRET;
  const ts = headers.get("x-slack-request-timestamp");
  const sig = headers.get("x-slack-signature");
  if (!secret || !ts || !sig || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const expected = `v0=${createHmac("sha256", secret).update(`v0:${ts}:${rawBody}`).digest("hex")}`;
  return expected.length === sig.length && timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

// The Slack Web API with the bot token, for opening the edit form.
export async function slackApi(method: string, body: object) {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`, "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Slack ${method}: ${json.error}`);
  return json;
}

// Replaces the card a button was clicked on, through the response_url Slack sent with the click.
export const updateCard = (responseUrl: string, blocks: Block[], text: string) =>
  fetch(responseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace_original: true, text, blocks }) });

// Message copy as a Slack quote: the subject in bold, then each line of the body.
export const quote = (copy: { subject: string; body: string }) =>
  [copy.subject && `*${copy.subject}*`, ...copy.body.split("\n")].filter((l) => l !== "").map((l) => `>${l}`).join("\n");
