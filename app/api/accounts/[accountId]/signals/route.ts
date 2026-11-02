import { refreshSignals } from "@/lib/accounts";

// Sumble's people search runs as a job and web research searches several times: allow up to five minutes.
export const maxDuration = 300;

// POST ?group=sumble (hiring and leadership) or ?group=research (AI initiatives).
export async function POST(req: Request, ctx: RouteContext<"/api/accounts/[accountId]/signals">) {
  const group = new URL(req.url).searchParams.get("group");
  if (group !== "sumble" && group !== "research") return Response.json({ error: "group must be sumble or research" }, { status: 400 });
  const error = await refreshSignals((await ctx.params).accountId, group);
  return Response.json({ error }, { status: error ? 500 : 200 });
}
