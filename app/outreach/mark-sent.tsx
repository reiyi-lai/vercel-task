"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { markSent } from "@/app/events/[eventId]/candidates/outreach-actions";

// Marks a step sent straight from the queue, with its drafted copy (or the saved edit).
export default function MarkSent({ campaignId, contactId, step }: { campaignId: string; contactId: string; step: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="primary" disabled={pending} onClick={() => startTransition(async () => setError(await markSent(campaignId, contactId, step)))}>
        {pending ? "Saving…" : "Mark Sent"}
      </Button>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}
