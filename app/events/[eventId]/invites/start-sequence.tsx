"use client";

import { useState, useTransition } from "react";
import { useSelection } from "@/components/selection";
import { Button } from "@/components/ui";
import { startSequence } from "./outreach-actions";

// Pushes a candidate to Outreach straight from the Invites list: step 1 goes out, later steps fall due from today, and
// the sender hears on Slack.
export default function StartSequence({ campaignId, contactId }: { campaignId: string; contactId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="primary" disabled={pending} onClick={() => startTransition(async () => setError(await startSequence(campaignId, contactId)))}>
        {pending ? "Pushing…" : "Push to Outreach"}
      </Button>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}

// Pushes the ticked candidates to Outreach, one after another; shows only once one is ticked. ready: those with an email,
// as the per-row button needs. Any that can't start are named with why.
export function PushSelected({ campaignId, ready }: { campaignId: string; ready: { id: string; name: string }[] }) {
  const { ids, clear } = useSelection();
  const [pending, startTransition] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const chosen = ready.filter((c) => ids.has(c.id));
  if (!chosen.length && !errors.length) return null;
  const push = () =>
    startTransition(async () => {
      const failed: string[] = [];
      for (const c of chosen) {
        const err = await startSequence(campaignId, c.id);
        if (err) failed.push(`${c.name}: ${err}`);
      }
      setErrors(failed);
      clear();
    });
  return (
    <div className="flex flex-col items-end gap-1">
      {chosen.length > 0 && (
        <Button variant="primary" disabled={pending} onClick={push}>{pending ? "Pushing…" : `Push Selected to Outreach (${chosen.length})`}</Button>
      )}
      {errors.map((e) => <p key={e} className="max-w-sm text-right text-label-12 text-red-900">{e}</p>)}
    </div>
  );
}
