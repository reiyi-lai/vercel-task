import { loadSnapshot } from "@/lib/data";
import { sendReminders } from "@/lib/outreach";

// GET ?run=morning|afternoon: Vercel Cron, scheduled in vercel.json (times in lib/rules.ts's TIMEZONE). At 9am, every
// unsent step that's due or overdue gets a card, so an overdue step is pinged each morning until it's marked sent.
// At 4pm, steps due today and still unsent get a second ping. Vercel sends CRON_SECRET as a bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const run = new URL(req.url).searchParams.get("run");
  if (run !== "morning" && run !== "afternoon") return Response.json({ error: "run must be morning or afternoon" }, { status: 400 });
  const s = await loadSnapshot();
  const results = await Promise.all(s.events.map((b) => sendReminders(b.campaign_id, run === "morning" ? ["Due", "Overdue"] : ["Due"])));
  return Response.json({ sent: results.reduce((n, r) => n + (r.sent ?? 0), 0), errors: results.flatMap((r) => (r.error ? [r.error] : [])) });
}
