"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useSelection } from "@/components/selection";
import { Button, Chevron } from "@/components/ui";
import { addCandidates } from "./[accountId]/actions";

// An account's row on the Accounts table. The chevron, at the right edge of the Account cell so every row's lines up,
// toggles the rows below it (children), one per executive.
export default function AccountRow({ name, detail, cells, children }: { name: string; detail: string; cells: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr className={`align-top ${open ? "border-b-0" : ""}`}>
        <td className="py-3 pr-1 pl-4">
          <div className="flex items-start justify-between gap-1">
            <div className="min-w-0">
              <p className="text-label-14 font-medium">{name}</p>
              <p className="text-label-12 text-gray-900">{detail}</p>
            </div>
            <button type="button" aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} executives at ${name}`} onClick={() => setOpen(!open)} className="-mt-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-gray-900 hover:bg-gray-100 hover:text-gray-1000">
              <Chevron open={open} />
            </button>
          </div>
        </td>
        {cells}
      </tr>
      {open && children}
    </>
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
