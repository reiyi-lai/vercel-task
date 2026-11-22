"use client";

import { useState, useTransition } from "react";
import { useSelection } from "@/components/selection";
import { Button } from "@/components/ui";
import { usePost } from "@/components/use-post";
import { addCandidates, removeFound } from "./actions";

// Searches Sumble for people at the account matching the event's target personas who aren't contacts yet. Takes up to
// a minute: Sumble's people search runs as a job. The results show under the account's contacts.
export function FindExecutives({ accountId, campaignId, searched }: { accountId: string; campaignId: string; searched: boolean }) {
  const { pending, error, post } = usePost();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={pending} onClick={() => post(`/api/accounts/${accountId}/executives`, { campaignId })}>
        {pending ? "Searching Sumble…" : searched ? "Search Again" : "Find More Executives"}
      </Button>
      {error && <p className="max-w-xs text-right text-label-12 text-red-900">{error}</p>}
    </div>
  );
}

// A Sumble result: add them as a contact on the account, where they can then be ticked as a candidate, or remove the
// result (a later search can find them again).
export function FoundActions({ accountId, campaignId, linkedinUrl }: { accountId: string; campaignId: string; linkedinUrl: string }) {
  const { pending, error, post } = usePost();
  const [removing, startRemove] = useTransition();
  const [removeError, setRemoveError] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-1">
        <Button size="sm" disabled={pending || removing} onClick={() => post(`/api/accounts/${accountId}/contacts`, { linkedinUrl })}>{pending ? "Adding…" : "Add to Contacts"}</Button>
        <button
          type="button"
          aria-label="Remove this result"
          title="Remove"
          disabled={pending || removing}
          onClick={() => startRemove(async () => setRemoveError(await removeFound(campaignId, linkedinUrl)))}
          className="grid size-7 cursor-pointer place-items-center rounded-lg text-heading-16 text-gray-900 hover:bg-gray-100 hover:text-gray-1000 disabled:pointer-events-none disabled:opacity-50"
        >
          ×
        </button>
      </div>
      {(error || removeError) && <p className="text-label-12 text-red-900">{error ?? removeError}</p>}
    </div>
  );
}

// Appears once executives are ticked, across accounts: adds them all as candidates.
export function AddCandidatesBar({ campaignId }: { campaignId: string }) {
  const { ids, clear } = useSelection();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  if (!ids.size) return null;
  const add = () =>
    startTransition(async () => {
      const err = await addCandidates(campaignId, [...ids]);
      setError(err);
      if (!err) clear();
    });
  return (
    <div className="material-medium sticky bottom-4 mt-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      {error ? <p className="text-label-13 text-red-900">{error}</p> : <p className="text-label-13">{ids.size} {ids.size === 1 ? "executive" : "executives"} selected</p>}
      <div className="flex gap-2">
        <Button onClick={clear} disabled={pending}>Clear</Button>
        <Button variant="primary" onClick={add} disabled={pending}>{pending ? "Adding…" : `Add ${ids.size === 1 ? "Candidate" : "Candidates"}`}</Button>
      </div>
    </div>
  );
}
