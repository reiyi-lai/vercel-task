import { addContact } from "@/lib/accounts";

// POST { linkedinUrl }: adds that person as a Contact on the account.
export async function POST(req: Request, ctx: RouteContext<"/api/accounts/[accountId]/contacts">) {
  const { linkedinUrl } = await req.json();
  if (typeof linkedinUrl !== "string") return Response.json({ error: "linkedinUrl is required" }, { status: 400 });
  const error = await addContact((await ctx.params).accountId, linkedinUrl);
  return Response.json({ error }, { status: error ? 500 : 200 });
}
