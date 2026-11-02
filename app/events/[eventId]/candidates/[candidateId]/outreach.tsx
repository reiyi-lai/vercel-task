"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button, Section, Status, type DotColor } from "@/components/ui";
import type { Outreach as OutreachRow } from "@/lib/data";
import { gmailDraft, type StepStatus } from "@/lib/sequence";
import FindEmail from "../find-email";
import { markSent, savePersonalLine, setOutcome, startSequence } from "./outreach-actions";

export type StepView = {
  index: number; day: number; channel: string; sender: string; subject: string; body: string;
  status: StepStatus | null; due: string | null; sent: string | null;
};
const statusColor: Record<StepStatus, DotColor> = { Sent: "green", Due: "amber", Overdue: "red", Upcoming: "gray", Stopped: "hollow" };
const OUTCOMES = ["Replied", "Accepted", "Declined", "Paused"] as const;

// The candidate's outreach for this event: their personalized line, then the event's sequence with each step's
// filled-in copy, due date and status. Sending happens outside Seatbook (Outreach in production); Mark Sent records it.
// to: where steps go. Email steps link a mailto with the step's copy filled in; LinkedIn steps link the profile.
export default function Outreach({ campaignId, contactId, outreach, steps, to }: {
  campaignId: string; contactId: string; outreach?: OutreachRow; steps: StepView[]; to: { email: string | null; linkedinUrl: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const [line, setLine] = useState(outreach?.personal_line ?? "");
  // Every step's message can be opened, due or not; the next unsent one starts open.
  const [open, setOpen] = useState(() => new Set([steps.findIndex((x) => x.status !== "Sent")]));
  const toggle = (i: number) => setOpen((prev) => (prev.has(i) ? new Set([...prev].filter((x) => x !== i)) : new Set([...prev, i])));
  const run = (action: () => Promise<string | undefined>) => startTransition(async () => setError(await action()));
  const draft = () =>
    startTransition(async () => {
      const res = await fetch("/api/outreach/line", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, contactId }) });
      const { error } = await res.json();
      setError(error);
      if (!error) router.refresh();
    });
  const started = !!outreach?.started_at;

  return (
    <Section
      title="Outreach Sequence"
      description="The event’s sequence, filled in for this executive. Send each step yourself, then mark it sent; the AE or BDR gets a Slack alert when something needs them."
      aside={
        started ? (
          <div className="flex flex-wrap gap-2">
            {outreach?.outcome === "Paused" ? (
              <Button disabled={pending} onClick={() => run(() => setOutcome(campaignId, contactId, null))}>Resume</Button>
            ) : (
              OUTCOMES.map((o) => (
                <Button key={o} disabled={pending || outreach?.outcome === o} onClick={() => run(() => setOutcome(campaignId, contactId, o))}>
                  {o === "Paused" ? "Pause" : o}
                </Button>
              ))
            )}
          </div>
        ) : (
          <Button variant="primary" disabled={pending || !steps.length} onClick={() => run(() => startSequence(campaignId, contactId))}>Start Sequence</Button>
        )
      }
    >
      <div className="space-y-4">
        {error && <p className="text-label-13 text-red-900">{error}</p>}
        {outreach?.outcome && <Status color={outreach.outcome === "Accepted" ? "green" : outreach.outcome === "Declined" ? "red" : "blue"}>{outreach.outcome}: remaining steps are stopped</Status>}

        <div className="material-base space-y-3 p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-heading-16">Personalized Line</h3>
            {outreach?.line_signal && <span className="text-label-12 text-gray-900">Draws on: {outreach.line_signal}</span>}
          </div>
          <textarea
            key={outreach?.personal_line ?? ""}
            defaultValue={outreach?.personal_line ?? ""}
            onChange={(e) => setLine(e.target.value)}
            rows={2}
            placeholder="One sentence tying this executive’s company to the event. Draft it with Claude or write your own."
            className="w-full rounded-lg bg-background-100 px-3 py-2 text-copy-14 shadow-border"
          />
          <div className="flex gap-2">
            <Button disabled={pending} onClick={draft}>{pending ? "Working…" : outreach?.personal_line ? "Redraft with Claude" : "Draft with Claude"}</Button>
            <Button disabled={pending || line === (outreach?.personal_line ?? "")} onClick={() => run(() => savePersonalLine(campaignId, contactId, line))}>Save Line</Button>
          </div>
        </div>

        {steps.length ? (
          <ol className="material-base divide-y divide-gray-alpha-400">
            {steps.map((x) => (
              <li key={x.index} className="px-5 py-4">
                {/* The whole header row toggles the step; its own links and buttons (and the title button) don't. */}
                <div
                  className="-mx-5 -my-4 flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4"
                  onClick={(e) => !(e.target as HTMLElement).closest("a, button") && toggle(x.index)}
                >
                  <div className="space-y-1">
                    <button type="button" aria-expanded={open.has(x.index)} onClick={() => toggle(x.index)} className="text-left">
                      <span aria-hidden className="mr-1.5 inline-block w-3 text-gray-900">{open.has(x.index) ? "▾" : "▸"}</span>
                      <span className="text-label-14 font-medium">Step {x.index + 1} · Day {x.day} · {x.channel}</span>
                      <span className="text-label-13 text-gray-900"> from {x.sender}</span>
                    </button>
                    {x.channel === "Email" &&
                      (to.email ? (
                        <p className="text-label-13">
                          <span className="text-gray-900">To: </span>
                          <a href={`mailto:${to.email}?subject=${encodeURIComponent(x.subject)}&body=${encodeURIComponent(x.body)}`} className="text-blue-900 hover:underline">{to.email}</a>
                        </p>
                      ) : (
                        <div className="flex flex-wrap items-center gap-3 text-label-13 text-gray-900">No email yet{to.linkedinUrl && <FindEmail contactId={contactId} />}</div>
                      ))}
                    {x.channel === "LinkedIn" && to.linkedinUrl && (
                      <a href={to.linkedinUrl} target="_blank" rel="noreferrer" className="block text-label-13 text-blue-900 hover:underline">LinkedIn profile ↗</a>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {x.status ? (
                      <Status color={statusColor[x.status]}>{x.status === "Sent" ? `Sent ${x.sent}` : x.status === "Stopped" ? "Stopped" : `${x.status} · ${x.due}`}</Status>
                    ) : (
                      <span className="text-label-13 text-gray-900">Not started</span>
                    )}
                    {started && x.status !== "Sent" && x.status !== "Stopped" && (
                      <Button disabled={pending} onClick={() => run(() => markSent(campaignId, contactId, x.index))}>Mark Sent</Button>
                    )}
                  </div>
                </div>
                {open.has(x.index) && (
                  <div className="mt-3 space-y-2 rounded-lg bg-background-200 p-4">
                    <p className="text-label-12 font-medium uppercase tracking-wide text-gray-900">{x.status === "Sent" ? "Sent copy" : "Draft"}</p>
                    {x.subject && <p className="text-label-13"><span className="text-gray-900">Subject:</span> {x.subject}</p>}
                    <p className="whitespace-pre-line text-copy-14">{x.body}</p>
                    <div className="flex flex-wrap gap-2">
                      {x.channel === "Email" && <Button variant="primary" href={gmailDraft(to.email, x.subject, x.body)}>Open in Gmail</Button>}
                      <Button onClick={() => navigator.clipboard.writeText(x.subject ? `${x.subject}\n\n${x.body}` : x.body)}>Copy</Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">This event has no sequence yet. Add steps on the Brief.</p>
        )}
      </div>
    </Section>
  );
}
