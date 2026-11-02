"use client";

import { useState, useTransition } from "react";
import { Button, Status } from "@/components/ui";
import { usePost } from "@/components/use-post";
import type { FoundExecutive } from "@/lib/data";
import { formatDate } from "@/lib/derive";
import { profileKey } from "@/lib/sumble";
import { setSelected } from "./actions";

export function SelectExecutive({ campaignId, contactId, name, selected }: { campaignId: string; contactId: string; name: string; selected: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <label className="flex cursor-pointer items-center gap-2 text-label-13">
      <input
        type="checkbox"
        className="size-4 accent-gray-1000"
        aria-label={`Add ${name} as a candidate`}
        checked={selected}
        disabled={pending}
        onChange={(e) => startTransition(async () => setError(await setSelected(campaignId, contactId, e.target.checked)))}
      />
      {error ? <span className="text-red-900">{error}</span> : selected ? "Candidate Added" : "Add Candidate"}
    </label>
  );
}

// Shows In CRM as soon as the add succeeds, without waiting for the page refresh.
export function AddToCrm({ accountId, linkedinUrl }: { accountId: string; linkedinUrl: string }) {
  const { pending, error, post } = usePost();
  const [added, setAdded] = useState(false);
  if (added) return <Status color="green">In CRM</Status>;
  return (
    <div className="flex flex-col gap-1 sm:items-end">
      <Button disabled={pending} onClick={() => post(`/api/accounts/${accountId}/contacts`, { linkedinUrl }, (d) => setAdded(!d.error))}>
        {pending ? "Adding…" : "Add to CRM"}
      </Button>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}

// Each takes up to a minute: Sumble's people search runs as a job, and web research searches several times.
const REFRESH = {
  sumble: { label: "Refresh Sumble Signals", busy: "Fetching from Sumble…" },
  research: { label: "Research AI Initiatives", busy: "Researching…" },
};

export function RefreshSignals({ accountId, group }: { accountId: string; group: keyof typeof REFRESH }) {
  const { pending, error, post } = usePost();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={pending} onClick={() => post(`/api/accounts/${accountId}/signals?group=${group}`, {})}>
        {pending ? REFRESH[group].busy : REFRESH[group].label}
      </Button>
      {error && <p className="max-w-sm text-right text-label-12 text-red-900">{error}</p>}
    </div>
  );
}

// Searches Sumble for people at the account matching the event's target personas who aren't contacts yet. found: the
// saved results of the last search; inCrm: profile keys already in the CRM, so added people show In CRM.
export function FindExecutives({ accountId, campaignId, found, inCrm }: { accountId: string; campaignId: string; found: FoundExecutive[]; inCrm: string[] }) {
  const { pending, error, post } = usePost();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} onClick={() => post(`/api/accounts/${accountId}/executives`, { campaignId })}>
          {pending ? "Searching Sumble…" : found.length ? "Search Again" : "Find Executives"}
        </Button>
        <span className="text-label-12 text-gray-900">
          {found.length ? `Found ${formatDate(found[0].found_at)} · ` : ""}Searches Sumble for this event’s target personas · about 100 credits
        </span>
      </div>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
      {found.length > 0 && (
        <ul className="divide-y divide-gray-alpha-400 rounded-xl shadow-border">
          {found.map((x) => (
            <li key={x.linkedin_url} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-label-14 font-medium">
                  <a href={x.linkedin_url} target="_blank" rel="noreferrer" className="hover:underline">{x.name} ↗</a>
                </p>
                <p className="text-label-12 text-gray-900">{[x.title, x.location].filter(Boolean).join(" · ")}</p>
                <Status color="green"><span className="text-label-12">Matches {x.persona}</span></Status>
              </div>
              {inCrm.includes(profileKey(x.linkedin_url)) ? <Status color="green">In CRM</Status> : <AddToCrm accountId={accountId} linkedinUrl={x.linkedin_url} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
