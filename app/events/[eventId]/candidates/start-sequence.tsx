"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui";
import { startSequence } from "./outreach-actions";

// Starts the event's outreach sequence for a candidate straight from the Candidates list: step 1 falls due today and
// its sender gets the Slack card.
export default function StartSequence({ campaignId, contactId }: { campaignId: string; contactId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button variant="primary" disabled={pending} onClick={() => startTransition(async () => setError(await startSequence(campaignId, contactId)))}>
        {pending ? "Starting…" : "Start Sequence"}
      </Button>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}
