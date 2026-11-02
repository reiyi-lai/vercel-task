"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { Button, Section, Status, type DotColor } from "@/components/ui";
import type { Candidate } from "@/lib/data";
import { gmailDraft, type StepStatus } from "@/lib/sequence";
import FindEmail from "../find-email";
import { markSent, saveDraft, setOutcome, startSequence } from "./outreach-actions";

export type StepView = {
  index: number; day: number; channel: string; sender: string; subject: string; body: string;
  status: StepStatus | null; due: string | null; sent: string | null; edited: boolean;
};
const statusColor: Record<StepStatus, DotColor> = { Sent: "green", Due: "amber", Overdue: "red", Upcoming: "gray", Stopped: "hollow" };
const OUTCOMES = ["Replied", "Accepted", "Declined", "Paused"] as const;

// The candidate's outreach for this event: their personalized line, then the event's sequence with each step's
// filled-in copy, due date and status. Sending happens outside Seatbook (Outreach in production); Mark Sent records it.
// to: where steps go. Email steps link a mailto with the step's copy filled in; LinkedIn steps link the profile.
export default function Outreach({ campaignId, contactId, outreach, steps, to }: {
  campaignId: string; contactId: string; outreach?: Candidate; steps: StepView[]; to: { email: string | null; linkedinUrl: string | null };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  // Every step's message can be opened, due or not. The next unsent step starts open, as does one linked to from Slack;
  // clicking flips a step from that default.
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const toggle = (i: number) => setFlipped((prev) => (prev.has(i) ? new Set([...prev].filter((x) => x !== i)) : new Set([...prev, i])));
  const nextUnsent = steps.findIndex((x) => x.status !== "Sent");
  // The step being edited before marking it sent, with the copy as edited so far.
  const [editing, setEditing] = useState<{ index: number; subject: string; body: string } | null>(null);

  // Slack's "Edit in Seatbook" links to #step-N: the browser scrolls there, and that step starts open.
  const hash = useSyncExternalStore(
    (onChange) => (addEventListener("hashchange", onChange), () => removeEventListener("hashchange", onChange)),
    () => location.hash,
    () => ""
  );
  const linked = Number(hash.match(/^#step-(\d+)$/)?.[1] ?? 0) - 1;
  const isOpen = (i: number) => (i === nextUnsent || i === linked) !== flipped.has(i);
  const run = (action: () => Promise<string | undefined>) => startTransition(async () => setError(await action()));
  const started = !!outreach?.started_at;

  return (
    <Section title="Outreach Sequence">
      <div className="space-y-4">
        {error && <p className="text-label-13 text-red-900">{error}</p>}
        {outreach?.outcome && <Status color={outreach.outcome === "Accepted" ? "green" : outreach.outcome === "Declined" ? "red" : "blue"}>{outreach.outcome}: remaining steps are stopped</Status>}

        {steps.length ? (
          <ol className="material-base divide-y divide-gray-alpha-400">
            {steps.map((x) => (
              <li key={x.index} id={`step-${x.index + 1}`} className="scroll-mt-6 px-5 py-4">
                {/* The whole header row toggles the step; its own links and buttons (and the title button) don't. */}
                <div
                  className="-mx-5 -my-4 flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4"
                  onClick={(e) => !(e.target as HTMLElement).closest("a, button") && toggle(x.index)}
                >
                  <div className="space-y-1">
                    <button type="button" aria-expanded={isOpen(x.index)} onClick={() => toggle(x.index)} className="text-left">
                      <span aria-hidden className="mr-1.5 inline-block w-3 text-gray-900">{isOpen(x.index) ? "▾" : "▸"}</span>
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
                {isOpen(x.index) && (
                  <div className="mt-3 space-y-2 rounded-lg bg-background-200 p-4">
                    <p className="text-label-12 font-medium uppercase tracking-wide text-gray-900">
                      {editing?.index === x.index ? "Editing" : x.status === "Sent" ? "Sent copy" : x.edited ? "Edited draft" : "Draft"}
                    </p>
                    {editing?.index === x.index ? (
                      <>
                        {x.subject && (
                          <input aria-label="Subject" value={editing.subject} onChange={(e) => setEditing({ ...editing, subject: e.target.value })}
                            className="h-9 w-full rounded-lg bg-background-100 px-3 text-label-14 shadow-border" />
                        )}
                        <textarea aria-label="Message" rows={10} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })}
                          className="w-full rounded-lg bg-background-100 px-3 py-2 text-copy-14 shadow-border" />
                        <div className="flex flex-wrap gap-2">
                          <Button variant="primary" disabled={pending}
                            onClick={() => run(async () => {
                              const err = await saveDraft(campaignId, contactId, x.index, { subject: editing.subject, body: editing.body });
                              if (!err) setEditing(null);
                              return err;
                            })}>
                            Save
                          </Button>
                          <Button onClick={() => setEditing(null)}>Cancel</Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {x.subject && <p className="text-label-13"><span className="text-gray-900">Subject:</span> {x.subject}</p>}
                        <p className="whitespace-pre-line text-copy-14">{x.body}</p>
                        <div className="flex flex-wrap gap-2">
                          {x.channel === "Email" && <Button variant="primary" href={gmailDraft(to.email, x.subject, x.body)}>Open in Gmail</Button>}
                          <Button onClick={() => navigator.clipboard.writeText(x.subject ? `${x.subject}\n\n${x.body}` : x.body)}>Copy</Button>
                          <Button onClick={() => setEditing({ index: x.index, subject: x.subject, body: x.body })}>Edit</Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">This event has no sequence yet. Add steps on the Brief.</p>
        )}

        {/* Status changes come after the sequence they act on. */}
        {started ? (
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
        )}
      </div>
    </Section>
  );
}
