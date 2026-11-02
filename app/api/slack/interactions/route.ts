import { after } from "next/server";
import { loadSnapshot } from "@/lib/data";
import { draftCopy, recordSent, sentCard } from "@/lib/outreach";
import { slackApi, updateCard, verifySlack } from "@/lib/slack";
import { expireFromRoute } from "@/lib/write";

// Slack's Interactivity Request URL. Buttons on a step card arrive as block_actions; the edit form's submit arrives as
// view_submission. Every request must carry a valid signature. Slack wants an answer within three seconds, and a
// click's trigger_id opens a form only within those three seconds, while loading the snapshot can take longer on a
// cold start. So each handler answers at once, opening the form empty if needed, and does the rest in after().
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySlack(raw, req.headers)) return new Response("Invalid signature", { status: 401 });
  const payload = JSON.parse(new URLSearchParams(raw).get("payload")!);
  const by = payload.user?.name ?? "Slack";

  if (payload.type === "block_actions") {
    const action = payload.actions[0];
    if (!["mark_sent", "edit_sent"].includes(action.action_id)) return new Response(null, { status: 200 }); // link buttons
    const [campaignId, contactId, step] = action.value.split("|");

    if (action.action_id === "mark_sent") {
      after(async () => {
        const s = await loadSnapshot();
        const c = s.contacts.find((x) => x.id === contactId)!;
        const draft = draftCopy(s, campaignId, c, Number(step));
        if (!(await recordSent(campaignId, contactId, Number(step), draft, by, expireFromRoute))) {
          await updateCard(payload.response_url, sentCard(s, campaignId, c, Number(step), draft, by), "Sent");
        }
      });
      return new Response(null, { status: 200 });
    }

    // Edit & Mark Sent: open the form now, then fill it with the drafted copy. Where to save it, and which card to
    // update, ride along in private_metadata.
    const { view } = await slackApi("views.open", {
      trigger_id: payload.trigger_id,
      view: {
        type: "modal",
        title: { type: "plain_text", text: "Edit & Mark Sent" },
        close: { type: "plain_text", text: "Cancel" },
        blocks: [{ type: "section", text: { type: "mrkdwn", text: "Loading the draft…" } }],
      },
    });
    after(async () => {
      const s = await loadSnapshot();
      const draft = draftCopy(s, campaignId, s.contacts.find((x) => x.id === contactId)!, Number(step));
      await slackApi("views.update", {
        view_id: view.id,
        hash: view.hash,
        view: {
          type: "modal",
          callback_id: "edit_sent",
          private_metadata: JSON.stringify({ value: action.value, responseUrl: payload.response_url }),
          title: { type: "plain_text", text: "Edit & Mark Sent" },
          submit: { type: "plain_text", text: "Mark Sent" },
          close: { type: "plain_text", text: "Cancel" },
          blocks: [
            ...(draft.subject
              ? [{ type: "input", block_id: "subject", label: { type: "plain_text", text: "Subject" }, element: { type: "plain_text_input", action_id: "v", initial_value: draft.subject } }]
              : []),
            {
              type: "input", block_id: "body", label: { type: "plain_text", text: "Message you sent" },
              element: { type: "plain_text_input", action_id: "v", multiline: true, initial_value: draft.body },
            },
          ],
        },
      });
    });
    return new Response(null, { status: 200 });
  }

  if (payload.type === "view_submission" && payload.view.callback_id === "edit_sent") {
    const { value, responseUrl } = JSON.parse(payload.view.private_metadata);
    const [campaignId, contactId, step] = value.split("|");
    const v = payload.view.state.values;
    const copy = { subject: v.subject?.v.value ?? "", body: v.body.v.value };
    after(async () => {
      if (await recordSent(campaignId, contactId, Number(step), copy, by, expireFromRoute)) return;
      const s = await loadSnapshot();
      await updateCard(responseUrl, sentCard(s, campaignId, s.contacts.find((x) => x.id === contactId)!, Number(step), copy, by), "Sent");
    });
    return new Response(null, { status: 200 }); // closes the form
  }

  return new Response(null, { status: 200 });
}
