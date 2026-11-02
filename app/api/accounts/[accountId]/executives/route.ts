import { findExecutives } from "@/lib/accounts";

export const maxDuration = 300;

// POST { campaignId }: finds and saves the people at the account who match that event's target personas and aren't
// contacts yet. Each search spends Sumble credits.
export async function POST(req: Request, ctx: RouteContext<"/api/accounts/[accountId]/executives">) {
  const { campaignId } = await req.json();
  if (typeof campaignId !== "string") return Response.json({ error: "campaignId is required" }, { status: 400 });
  const error = await findExecutives((await ctx.params).accountId, campaignId);
  return Response.json({ error }, { status: error ? 500 : 200 });
}
