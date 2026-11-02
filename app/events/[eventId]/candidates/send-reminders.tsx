"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui";

// Posts Slack digests of due and overdue steps to each AE or BDR.
export default function SendReminders({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string>();
  const send = () =>
    startTransition(async () => {
      const res = await fetch("/api/outreach/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId }) });
      const { error, sent } = await res.json();
      setNote(error ?? (sent ? `Sent ${sent} ${sent === 1 ? "digest" : "digests"}.` : "Nothing is due."));
      router.refresh();
    });
  return (
    <div className="flex flex-col items-end gap-1">
      <Button disabled={pending} onClick={send}>{pending ? "Sending…" : "Send Due-Step Reminders"}</Button>
      {note && <p className="text-label-12 text-gray-900">{note}</p>}
    </div>
  );
}
