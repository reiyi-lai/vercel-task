import { sendReminders } from "@/lib/outreach";

// POST { campaignId }: Slack digests of due and overdue steps for one event, from the Candidates page.
export async function POST(req: Request) {
  const { campaignId } = await req.json();
  if (typeof campaignId !== "string") return Response.json({ error: "campaignId is required" }, { status: 400 });
  const result = await sendReminders(campaignId);
  return Response.json(result, { status: result.error ? 500 : 200 });
}

