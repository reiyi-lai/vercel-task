import { draftLine } from "@/lib/outreach";

// POST { campaignId, contactId }: Claude drafts the candidate's personalized line from their account's context.
export async function POST(req: Request) {
  const { campaignId, contactId } = await req.json();
  if (typeof campaignId !== "string" || typeof contactId !== "string") return Response.json({ error: "campaignId and contactId are required" }, { status: 400 });
  const error = await draftLine(campaignId, contactId);
  return Response.json({ error }, { status: error ? 500 : 200 });
}
