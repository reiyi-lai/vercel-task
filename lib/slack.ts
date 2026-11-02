import { createHmac, timingSafeEqual } from "node:crypto";
import { ok, type Db } from "./write";

// Slack alerts are for exceptions: a step falling due, a reply to handle, an acceptance or decline. Each is saved for the
// in-app feed and, when SLACK_WEBHOOK_URL is set, posted to that channel. A step card's Mark Sent button comes back to
// /api/slack/interactions, which needs the app's Interactivity turned on and its SLACK_SIGNING_SECRET; its other buttons
// are links (Open in Gmail, Edit in Seatbook). Production would DM each AE or BDR instead.

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

// Replaces the card a button was clicked on, through the response_url Slack sent with the click.
export const updateCard = (responseUrl: string, blocks: Block[], text: string) =>
  fetch(responseUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ replace_original: true, text, blocks }) });

// Message copy as a Slack quote: the subject in bold, then each line of the body.
export const quote = (copy: { subject: string; body: string }) =>
  [copy.subject && `*${copy.subject}*`, ...copy.body.split("\n")].filter((l) => l !== "").map((l) => `>${l}`).join("\n");
