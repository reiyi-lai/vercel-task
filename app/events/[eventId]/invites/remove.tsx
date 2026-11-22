"use client";

import { useRef, useState, useTransition } from "react";
import { useSelection } from "@/components/selection";
import { Button, Modal } from "@/components/ui";
import { removeCandidates } from "../contacts/actions";

// Remove Selected on the Candidates list confirms in a modal. Removing deletes their outreach too, so re-selecting
// starts the sequence over.

export function RemoveSelected({ campaignId, candidates }: { campaignId: string; candidates: { id: string; name: string; started: boolean }[] }) {
  const { ids, clear } = useSelection();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const chosen = candidates.filter((c) => ids.has(c.id));
  const started = chosen.filter((c) => c.started).length;
  const remove = () =>
    startTransition(async () => {
      const err = await removeCandidates(campaignId, [...ids]);
      setError(err);
      if (!err) {
        clear();
        dialog.current?.close();
      }
    });
  return (
    <>
      <Button disabled={!chosen.length} onClick={() => dialog.current?.showModal()}>
        Remove Selected{chosen.length > 0 && ` (${chosen.length})`}
      </Button>
      <Modal ref={dialog} title={`Remove ${chosen.length} ${chosen.length === 1 ? "Candidate" : "Candidates"}?`} onClose={() => setError(undefined)}>
        <p className="mt-2 text-copy-14 text-gray-900">{chosen.map((c) => c.name).join(", ")}</p>
        {started > 0 && (
          <p className="mt-3 text-copy-14">
            {started} {started === 1 ? "has" : "have"} started outreach. Removing resets the sequence; if re-selected, it starts again from step 1.
          </p>
        )}
        {error && <p className="mt-3 text-label-13 text-red-900">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={() => dialog.current?.close()}>Cancel</Button>
          <Button variant="primary" disabled={pending} onClick={remove}>{pending ? "Removing…" : "Remove"}</Button>
        </div>
      </Modal>
    </>
  );
}
