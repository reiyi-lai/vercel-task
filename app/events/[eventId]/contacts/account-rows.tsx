import type { ReactNode } from "react";
import { SelectCheckbox } from "@/components/selection";
import { Badge, Check, Status } from "@/components/ui";
import type { FoundExecutive, Snapshot } from "@/lib/data";
import type { accountPlan } from "@/lib/qualify";
import { NEW_IN_ROLE_SINCE } from "@/lib/rules";
import { profileKey } from "@/lib/sumble";
import { FindExecutives, FoundActions } from "./controls";
import { AccountGroup } from "./filters";

// An account's executives for an event, as rows of a ContactsTable: on the Contacts page under a quiet account line, and
// on the AE/BDR page when an account is opened (its own row is the header there, so no account line).

type Plan = ReturnType<typeof accountPlan>;
const CONTACT_ROW = "group-data-collapsed/contacts:hidden";
const month = (ym: string) => new Date(`${ym}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

// Whether the account is real, so Sumble can search it (sample accounts use .example websites).
export const isLive = (plan: Plan) => !plan.account.website?.endsWith(".example");

// Find More Executives results for the account and event, without anyone since added to the CRM.
export function foundFor(s: Snapshot, plan: Plan, campaignId: string): FoundExecutive[] {
  const inCrm = new Set(s.contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
  return s.found_executives.filter((x) => x.account_id === plan.account.id && x.campaign_id === campaignId && !inCrm.has(profileKey(x.linkedin_url)));
}

// Executive takes what's left; the actions column is fixed, wide enough for its buttons inside its padding (they sit
// flush with its checkboxes).
const COLUMNS = (
  <colgroup>
    <col />
    <col className="w-[22%]" />
    <col className="w-[26%]" />
    <col className="w-48" />
  </colgroup>
);
const TABLE = "w-full table-fixed text-left";

// The rows in a card, around one or more AccountRows, with the column titles as plain text above it (a table of their
// own with the same columns, so they line up). bare: just the rows, no card or titles, for inside another card where the
// rows speak for themselves. Inside ContactsArea, the titles and contact rows hide while it's collapsed (CONTACT_ROW),
// leaving the account lines.
export function ContactsTable({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const rows = <table className={TABLE}>{COLUMNS}{children}</table>;
  return (
    // The scroll box clips what's outside it, so it leaves room for the card's border (a shadow) and takes it back in
    // margin, keeping the alignment.
    <div className="-m-0.5 overflow-x-auto p-0.5">
      <div className="min-w-[880px]">
        {bare ? rows : (
          <>
            <table className={`${CONTACT_ROW} ${TABLE}`}>
              {COLUMNS}
              <thead className="text-label-12 text-gray-900">
                <tr>
                  <th className="px-4 pt-4 pb-3 font-medium">Executive</th>
                  <th className="px-4 pt-4 pb-3 font-medium">Event Fit</th>
                  <th className="px-4 pt-4 pb-3 font-medium">Prior Engagement</th>
                  <th className="px-4 pt-4 pb-3 font-medium">Add as Candidate</th>
                </tr>
              </thead>
            </table>
            <div className="material-base">{rows}</div>
          </>
        )}
      </div>
    </div>
  );
}

// executives: the ones to show (the Contacts filters may narrow them); found: Sumble results to list under them.
// accountLine: the account's pill line with Find More Executives, where the account has no row of its own.
export function AccountRows({ plan, executives = plan.executives, found, campaignId, accountLine }: {
  plan: Plan; executives?: Plan["executives"]; found: FoundExecutive[]; campaignId: string; accountLine: boolean;
}) {
  const live = isLive(plan);
  const selected = plan.executives.filter((e) => e.selected).length;
  return (
    <AccountGroup id={plan.account.id} selected={selected > 0} className="scroll-mt-6 border-t border-gray-alpha-400 first-of-type:border-t-0">
      {accountLine && (
        // The account line only groups its contacts: small, quiet, with the context that bears on who to pick.
        <tr>
          <td colSpan={3} className="px-4 pt-4 pb-1 text-label-13">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <Badge variant="outline" size="md">{plan.account.name}</Badge>
              <span className="text-gray-900">{[plan.account.icp_tier, plan.account.vertical].filter(Boolean).join(" · ")}</span>
              {/* Whether anyone here has been picked yet, so the accounts still to cover stand out. */}
              <Status color={selected ? "green" : "amber"}>
                <span className="text-label-13">{selected ? `${selected} ${selected === 1 ? "candidate" : "candidates"} selected` : "No candidates selected"}</span>
              </Status>
            </div>
          </td>
          {/* Finding more is for when the contacts show, so it hides with them. */}
          <td className={`${CONTACT_ROW} px-4 pt-4 pb-1`}>
            {live && <FindExecutives accountId={plan.account.id} campaignId={campaignId} searched={found.length > 0} />}
          </td>
        </tr>
      )}
      {!plan.executives.length && (
        <tr className={CONTACT_ROW}>
          <td colSpan={4} className="px-4 py-3 text-label-13 text-gray-900">
            No executives in the CRM yet.{live ? " Find More Executives searches Sumble for this event’s target personas." : ""}
          </td>
        </tr>
      )}
      {executives.map((e) => {
        const name = `${e.contact.first_name} ${e.contact.last_name}`;
        return (
          <tr key={e.contact.id} className={`${CONTACT_ROW} align-top text-label-13 ${e.status === "Excluded" ? "text-gray-900" : ""}`}>
            {/* Contacts sit indented under their account. */}
            <td className="py-2.5 pr-4 pl-8">
              {e.contact.linkedin_url && !e.contact.linkedin_url.includes("linkedin.example") ? (
                <a href={e.contact.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-label-14 font-medium hover:underline">{name} ↗</a>
              ) : (
                <p className="truncate text-label-14 font-medium">{name}</p>
              )}
              <p className="text-label-12 text-gray-900">{e.contact.title}</p>
            </td>
            <td className="px-4 py-2.5">
              {/* One dot per check (rank, location, …); an excluded contact shows only why. */}
              <ul className="space-y-1">
                {e.labels.map((l) => <li key={l.text}><Status color={l.color}><span className="text-label-13">{l.text}</span></Status></li>)}
              </ul>
            </td>
            <td className="px-4 py-2.5">
              <ul className="space-y-1.5">
                {e.engagement.map((l) => (
                  <li key={l.text}>
                    <Status color={l.color}><span className="text-label-13">{l.text}</span></Status>
                    {l.detail && <p className="pl-3.5 text-label-12 text-gray-900">{l.detail}</p>}
                  </li>
                ))}
              </ul>
            </td>
            {/* The main action: tick to add as a candidate. Excluded contacts can't be added. */}
            <td className="px-4 py-2.5">
              {e.selected ? (
                <span className="flex items-center gap-1.5 text-label-13 text-gray-900"><Check className="text-green-900" />Added</span>
              ) : e.status !== "Excluded" ? (
                <SelectCheckbox id={e.contact.id} name={name} size="lg" />
              ) : (
                <span className="text-label-12 text-gray-900">Not eligible</span>
              )}
            </td>
          </tr>
        );
      })}
      {found.map((x) => (
        <tr key={x.linkedin_url} className={`${CONTACT_ROW} align-top text-label-13`}>
          <td className="py-2.5 pr-4 pl-8">
            <a href={x.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-label-14 font-medium hover:underline">{x.name} ↗</a>
            <p className="text-label-12 text-gray-900">{[x.title, x.location].filter(Boolean).join(" · ")}</p>
          </td>
          <td className="px-4 py-2.5">
            {x.persona ? (
              <Status color="green"><span className="text-label-13">Matches {x.persona}</span></Status>
            ) : (
              <Status color="gray"><span className="text-label-13">Not a target persona</span></Status>
            )}
          </td>
          <td className="px-4 py-2.5">
            {x.started && x.started >= NEW_IN_ROLE_SINCE && <Status color="blue"><span className="text-label-12">New in role · {month(x.started)}</span></Status>}
          </td>
          <td className="px-4 py-2.5">
            <FoundActions accountId={plan.account.id} campaignId={campaignId} linkedinUrl={x.linkedin_url} />
          </td>
        </tr>
      ))}
      <tr aria-hidden><td colSpan={4} className="h-2" /></tr>
    </AccountGroup>
  );
}
