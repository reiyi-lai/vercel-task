import type { ReactNode } from "react";
import { SelectCheckbox } from "@/components/selection";
import { Check, Status } from "@/components/ui";
import type { FoundExecutive, Snapshot } from "@/lib/data";
import { SENIORITY } from "@/lib/brief";
import { holdsRank, type accountPlan, type Label } from "@/lib/qualify";
import { NEW_IN_ROLE_SINCE } from "@/lib/rules";
import { profileKey } from "@/lib/sumble";
import { FoundActions } from "./controls";

// An account's executives for an event, as rows of a ContactsTable: in the Accounts page's panel for the chosen account,
// and on the AE/BDR page when an account is opened. Both give the account its own header, with Find More Executives.

type Plan = ReturnType<typeof accountPlan>;
const month = (ym: string) => new Date(`${ym}-01`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });

// Whether the account is real, so Sumble can search it (sample accounts use .example websites).
export const isLive = (plan: Plan) => !plan.account.website?.endsWith(".example");

// Find More Executives results for the account and event, without anyone since added to the CRM, each with its seniority
// label, the same check as for contacts.
export function foundFor(s: Snapshot, plan: Plan, campaignId: string): (FoundExecutive & { seniority: Label })[] {
  const min = s.events.find((b) => b.campaign_id === campaignId)!.min_seniority;
  const inCrm = new Set(s.contacts.flatMap((c) => (c.linkedin_url ? [profileKey(c.linkedin_url)] : [])));
  return s.found_executives
    .filter((x) => x.account_id === plan.account.id && x.campaign_id === campaignId && !inCrm.has(profileKey(x.linkedin_url)))
    .map((x) => ({ ...x, seniority: holdsRank(x.title ?? "", min) ? { text: `Matches ${SENIORITY[min]}`, color: "green" } : { text: "Seniority not in title", color: "gray" } }));
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
// rows speak for themselves.
export function ContactsTable({ children, bare = false }: { children: ReactNode; bare?: boolean }) {
  const rows = <table className={TABLE}>{COLUMNS}{children}</table>;
  return (
    // The scroll box clips what's outside it, so it leaves room for the card's border (a shadow) and takes it back in
    // margin, keeping the alignment.
    <div className="-m-0.5 overflow-x-auto p-0.5">
      <div className="min-w-[720px]">
        {bare ? rows : (
          <>
            <table className={TABLE}>
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

// executives: the ones to show (the filters may narrow them); found: Sumble results to list under them.
export function AccountRows({ plan, executives = plan.executives, found, campaignId }: {
  plan: Plan; executives?: Plan["executives"]; found: ReturnType<typeof foundFor>; campaignId: string;
}) {
  const live = isLive(plan);
  return (
    <tbody>
      {!plan.executives.length && (
        <tr>
          <td colSpan={4} className="px-4 py-3 text-label-13 text-gray-900">
            No executives in the CRM yet.{live ? " Find More Executives searches Sumble for this event’s target personas." : ""}
          </td>
        </tr>
      )}
      {executives.map((e) => {
        const name = `${e.contact.first_name} ${e.contact.last_name}`;
        return (
          <tr key={e.contact.id} className={`align-top text-label-13 ${e.status === "Excluded" ? "text-gray-900" : ""}`}>
            <td className="px-4 py-2.5">
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
        <tr key={x.linkedin_url} className="align-top text-label-13">
          <td className="px-4 py-2.5">
            <a href={x.linkedin_url} target="_blank" rel="noreferrer" className="block truncate text-label-14 font-medium hover:underline">{x.name} ↗</a>
            <p className="text-label-12 text-gray-900">{[x.title, x.location].filter(Boolean).join(" · ")}</p>
          </td>
          <td className="px-4 py-2.5">
            {/* Seniority first, as for contacts, then whether the role is one of the brief's personas. */}
            <ul className="space-y-1">
              <li><Status color={x.seniority.color}><span className="text-label-13">{x.seniority.text}</span></Status></li>
              <li>
                {x.persona ? (
                  <Status color="green"><span className="text-label-13">Target persona match: {x.persona}</span></Status>
                ) : (
                  <Status color="gray"><span className="text-label-13">Not in target persona role</span></Status>
                )}
              </li>
            </ul>
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
    </tbody>
  );
}
