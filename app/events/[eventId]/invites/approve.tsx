"use client";

import { useState, useTransition } from "react";
import { useSelection } from "@/components/selection";
import { Button } from "@/components/ui";
import { approveCandidates } from "./outreach-actions";

// Marketing approves candidates for their seats, one at a time or the checked ones at once. Approved candidates move to
// their AE's or BDR's Push to Outreach list.

export function Approve({ campaignId, contactIds, label = "Approve", onDone }: { campaignId: string; contactIds: string[]; label?: string; onDone?: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const approve = () =>
    startTransition(async () => {
      const err = await approveCandidates(campaignId, contactIds);
      setError(err);
      if (!err) onDone?.();
    });
  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="primary" disabled={pending || !contactIds.length} onClick={approve}>{pending ? "Approving…" : label}</Button>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}

// The checked candidates still waiting for approval; shows only once one is ticked.
export function ApproveSelected({ campaignId, pending }: { campaignId: string; pending: string[] }) {
  const { ids, clear } = useSelection();
  const chosen = pending.filter((id) => ids.has(id));
  if (!chosen.length) return null;
  return <Approve campaignId={campaignId} contactIds={chosen} label={`Approve Selected (${chosen.length})`} onDone={clear} />;
}
