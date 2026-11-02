import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Account, AccountSignal } from "./data";
import { AS_OF } from "./rules";
import { sumble, type SumbleJob, type SumblePerson } from "./sumble";

// Live signals for one account, from three sources:
// hiring (Sumble job posts), leadership changes (Sumble people), and initiatives (Claude with web search).

const since = new Date(AS_OF);
since.setUTCMonth(since.getUTCMonth() - 6);
const SINCE = since.toISOString().slice(0, 10);
const SINCE_LABEL = since.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

// The Sumble organization behind an account's website; null when Sumble doesn't know it.
export async function sumbleOrgId(a: Account): Promise<number | null> {
  const res = await sumble("organizations", { organizations: [{ url: a.website }], select: { attributes: ["id"] } });
  return res.organizations[0]?.attributes?.id ?? null;
}

// Sumble technology categories for each theme: coding agents for Software Factories, agent frameworks for Apps & Agents.
const HIRING = [
  { theme: "Software Factories", category: "coding-agents", label: "coding agents" },
  { theme: "Apps & Agents", category: "ai-frameworks-for-language-models", label: "AI agent frameworks" },
];

// One signal per theme: how many recent job posts name those technologies, and the latest few.
export async function hiringSignals(accountId: string, orgId: number): Promise<AccountSignal[]> {
  const results = await Promise.all(
    HIRING.map(async (h) => {
      const res = await sumble("jobs", {
        filter: { organization_ids: [orgId], query: { query: `technology_category EQ '${h.category}' AND since EQ '${SINCE}'` } },
        select: { attributes: ["title", "posted_date"] },
        limit: 3,
      });
      const jobs: SumbleJob[] = res.jobs ?? [];
      if (!res.total || !jobs.length) return null;
      return {
        account_id: accountId, category: "hiring" as const, theme: h.theme,
        title: `${res.total} job ${res.total === 1 ? "post mentions" : "posts mention"} ${h.label} since ${SINCE_LABEL}`,
        detail: `Latest: ${[...new Set(jobs.map((j) => j.attributes.title))].join("; ")}`,
        signal_date: jobs[0].attributes.posted_date.slice(0, 10), url: jobs[0].sumble_url, source: "Sumble job posts", person_linkedin_url: null,
      };
    })
  );
  return results.filter((x) => x !== null);
}

const themeOf = (title: string) =>
  /\b(ai|machine learning|data|security)\b/i.test(title) ? "Apps & Agents" : /engineering|platform|developer|software|technology/i.test(title) ? "Software Factories" : null;

// Technical leaders, VP and above, whose current role began in the last six months. Their work history tells a promotion
// (previous role at the same company) from an external hire; the same title again is a profile edit, not a change.
export async function leadershipSignals(accountId: string, orgId: number): Promise<AccountSignal[]> {
  const query = "(job_level EQ 'CXO' OR job_level EQ 'SVP' OR job_level EQ 'VP') AND (job_function EQ 'Engineering & R&D' OR job_function EQ 'Information Technology')";
  const res = await sumble("people", {
    filter: { organization_ids: [orgId], query: { query } },
    select: { attributes: ["name", "job_title", "linkedin_url", "current_employer"] },
    order_by_column: "start_date", order_by_direction: "DESC", limit: 7,
  });
  // Sumble can return one person twice (two profiles): keep the first per name and title.
  const recent = (res.people as SumblePerson[])
    .filter((p) => (p.attributes?.current_employer?.start_date ?? "") >= SINCE.slice(0, 7))
    .filter((p, i, all) => all.findIndex((q) => q.attributes?.name === p.attributes?.name && q.attributes?.job_title === p.attributes?.job_title) === i);
  if (!recent.length) return [];
  const history = await sumble("people", { people: recent.map((p) => ({ linkedin_url: p.attributes!.linkedin_url })), select: { attributes: ["experience"] } });

  return recent.flatMap((p, i) => {
    const a = p.attributes!;
    const [, prev] = (history.people[i] as SumblePerson).attributes?.experience ?? [];
    const promoted = prev?.employer.organization_id === orgId;
    if (promoted && prev.title === a.job_title) return [];
    return [{
      account_id: accountId, category: "leadership" as const, theme: themeOf(a.job_title ?? ""),
      title: `${a.name} ${promoted ? "promoted to" : "started as"} ${a.job_title}`,
      detail: prev ? (promoted ? `Previously ${prev.title}` : `Joined from ${prev.employer.name}`) : null,
      signal_date: `${a.current_employer!.start_date}-01`, url: a.linkedin_url ?? null, source: "Sumble people", person_linkedin_url: a.linkedin_url ?? null,
    }];
  });
}

const Initiatives = z.object({
  signals: z.array(
    z.object({
      theme: z.enum(["Internal Software", "Retail/Agentic Commerce", "Financial Services"]),
      title: z.string().describe("One line: what the company did"),
      detail: z.string().describe("One sentence on what the company did and its scope, with the company as the subject"),
      date: z.string().describe("Announcement date, YYYY-MM-DD"),
      url: z.string().describe("The source page"),
    })
  ),
});

const RESEARCH_PROMPT = `You research one company for Vercel's enterprise event team, which invites technology executives to events about building with AI.

Find the strongest public announcement from ${SINCE} onward for each of these themes, at most one per theme:
- Internal Software: AI assistants or agents the company rolls out to its own employees, an AI governance program, or an internal AI mandate; failing that, an AI assistant or agent it launches for customers. AI coding agents adopted across its engineering teams, agent-assisted software delivery, or a developer productivity program built on AI.
- Retail/Agentic Commerce: a ChatGPT app, agentic checkout, AI shopping assistant, or agent-initiated payments.
- Financial Services:  AI put to work in banking, payments, insurance or wealth management: fraud and risk detection, compliance and model governance, underwriting or claims, copilots for bankers, advisors or service teams, or AI-built apps run under regulatory controls.

Internal adoption matters more than products: a company putting agents to work for its own people tells us its technology leaders own the problem. Search each theme separately, using the industry angles you're given, so one busy theme doesn't crowd out the others.

Only count initiatives that the company itself or reputable press reported, with a date. Skip marketing that merely mentions AI, partnerships without a rollout, and anything before ${SINCE}. Leave a theme out when nothing qualifies; an empty list is a fine answer.

Keep every field about the initiative itself. Lead the detail with what the company did, for example "Visa's network, tokens, real-time authorization and fraud monitoring will support agentic payments in OpenAI's products", not with who reported it: the url already credits the source. Don't comment on your search in any field.`;

// Where AI initiatives tend to show up in each vertical, to aim the searches.
const INDUSTRY_SEARCH: Record<string, string> = {
  "Financial Services": "AI in fraud and risk operations, compliance and model governance, copilots for bankers, advisors or service agents, and developer platforms under regulatory controls.",
  Retail: "AI shopping assistants and search, agentic checkout, store and supply-chain agents, and engineering platforms behind digital commerce.",
  Healthcare: "clinical documentation and admin agents, AI governance for patient data, and internal developer platforms.",
  "Transportation & Logistics": "dispatch, routing and visibility agents, internal tools for operations, and engineering modernization.",
};

// Initiatives from web research: Claude searches the web and returns dated, sourced announcements.
export async function initiativeSignals(a: Account): Promise<AccountSignal[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Web research needs ANTHROPIC_API_KEY.");
  const client = new Anthropic();
  const angles = INDUSTRY_SEARCH[a.vertical ?? ""];
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    { role: "user", content: `${a.name} (${a.website})${a.vertical ? `, ${a.vertical}` : ""}.${angles ? ` Industry angles: ${angles}` : ""}` },
  ];
  for (let turn = 0; turn < 3; turn++) {
    const res = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: RESEARCH_PROMPT,
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 15 }],
      output_config: { effort: "medium", format: betaZodOutputFormat(Initiatives) },
      messages,
    });
    // A long search can pause the turn; send it back as is and the server resumes it.
    if (res.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: res.content });
      continue;
    }
    if (res.stop_reason === "refusal") throw new Error(`Web research declined for ${a.name}.`);
    if (!res.parsed_output) throw new Error(`Web research returned no usable result for ${a.name}.`);
    // At most one per theme: the schema can't enforce it, so keep the first Claude gave for each.
    const signals = res.parsed_output.signals.filter((x, i, all) => all.findIndex((y) => y.theme === x.theme) === i);
    return signals.map((x) => ({
      account_id: a.id, category: "initiative", theme: x.theme, title: x.title, detail: x.detail,
      signal_date: x.date, url: x.url, source: "Web research", person_linkedin_url: null,
    }));
  }
  throw new Error(`Web research for ${a.name} didn't finish.`);
}
