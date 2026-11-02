import { after } from "next/server";
import { loadSnapshot } from "@/lib/data";
import { draftCopy, recordSent, sentCard } from "@/lib/outreach";
import { updateCard, verifySlack } from "@/lib/slack";
import { expireFromRoute } from "@/lib/write";

// Slack's Interactivity Request URL: a step card's Mark Sent button arrives here as block_actions (its other buttons
// are plain links). Every request must carry a valid signature. Slack wants an answer within three seconds, and loading
// the snapshot can take longer on a cold start, so it answers at once and records the send in after().
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySlack(raw, req.headers)) return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(new URLSearchParams(raw).get("payload")!);
  const action = payload.type === "block_actions" ? payload.actions[0] : null;

  if (action?.action_id === "mark_sent") {
    const [campaignId, contactId, step] = action.value.split("|");
    const by = payload.user?.name ?? "Slack";
    after(async () => {
      const s = await loadSnapshot();
      const c = s.contacts.find((x) => x.id === contactId)!;
      const draft = draftCopy(s, campaignId, c, Number(step));
      if (!(await recordSent(campaignId, contactId, Number(step), draft, by, expireFromRoute))) {
        await updateCard(payload.response_url, sentCard(s, campaignId, c, Number(step), draft, by), "Sent");
      }
    });
  }
  return new Response(null, { status: 200 });
}
