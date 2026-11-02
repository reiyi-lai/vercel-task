import { findEmail } from "@/lib/accounts";

// POST: reveals the contact's work email through Sumble and saves it.
export async function POST(_req: Request, ctx: RouteContext<"/api/contacts/[contactId]/email">) {
  const error = await findEmail((await ctx.params).contactId);
  return Response.json({ error }, { status: error ? 500 : 200 });
}
