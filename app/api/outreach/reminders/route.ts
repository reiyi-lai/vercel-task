import { loadSnapshot } from "@/lib/data";
import { sendReminders } from "@/lib/outreach";

// GET: Vercel Cron, daily at 9am (scheduled in vercel.json; times in lib/rules.ts's TIMEZONE). Every unsent step that's
// due or overdue gets a card, so an overdue step is pinged each morning until it's marked sent. Vercel sends
// CRON_SECRET as a bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("Unauthorized", { status: 401 });
  const s = await loadSnapshot();
  const results = await Promise.all(s.events.map((b) => sendReminders(b.campaign_id)));
  return Response.json({ sent: results.reduce((n, r) => n + (r.sent ?? 0), 0), errors: results.flatMap((r) => (r.error ? [r.error] : [])) });
}
