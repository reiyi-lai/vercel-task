"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { Badge, Button, Modal, Section, Status } from "@/components/ui";
import { missingFields } from "@/lib/candidates";
import type { Candidate } from "@/lib/data";
import type { Overlap } from "@/lib/overlap";
import { generatePlan, generateWorkHistory } from "./actions";
import ImportCandidates from "./import";

type Kind = "history" | "plan";
const actions = { history: generateWorkHistory, plan: generatePlan };
const ready: Record<Kind, (c: Candidate) => boolean> = {
  history: (c) => !missingFields(c).includes("LinkedIn URL"),
  plan: (c) => c.experience !== null,
};
const name = (c: Candidate) => `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "Unnamed";
// Same line as the Relationship Map's evidence, e.g. "Same Company: Notion, 2014–2016".
const sameCompany = (o: Overlap) => `Same Company: ${o.company}, ${o.start.slice(0, 4)}–${o.end?.slice(0, 4) ?? "present"}`;
const th = "px-4 py-3 text-label-12 font-medium text-gray-900";

// Imported candidates. Generate each one's Sumble work history, then the invitation plan: the warm contacts
// who worked alongside them, tagged with the route each opens. Select rows to do several at once.
export default function CandidatesTable({ campaignId, candidates }: { campaignId: string; candidates: Candidate[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState<{ kind: Kind; ids: string[] }>();
  const [error, setError] = useState<string>();
  const [, startTransition] = useTransition();
  const [view, setView] = useState<{ title: string; body: ReactNode }>();
  const dialog = useRef<HTMLDialogElement>(null);

  const eligible = (kind: Kind) => candidates.filter((c) => selected.includes(c.id) && ready[kind](c)).map((c) => c.id);
  const run = (kind: Kind, ids: string[]) => {
    setBusy({ kind, ids });
    setError(undefined);
    startTransition(async () => {
      setError(await actions[kind](ids));
      setBusy(undefined);
      setSelected([]);
    });
  };
  const show = (title: string, body: ReactNode) => {
    setView({ title, body });
    dialog.current!.showModal();
  };
  const working = (kind: Kind, c: Candidate) => busy?.kind === kind && busy.ids.includes(c.id);

  return (
    <Section
      title="Imported Candidates"
      description="Generate each candidate’s work history from Sumble, then their invitation plan from warm contacts who worked alongside them."
      aside={
        <div className="flex flex-wrap gap-2">
          {selected.length > 0 && (["history", "plan"] as const).map((kind) => (
            <Button key={kind} disabled={!!busy || !eligible(kind).length} onClick={() => run(kind, eligible(kind))}>
              {kind === "history" ? "Generate Work History" : "Generate Invitation Plan"} ({eligible(kind).length})
            </Button>
          ))}
          <ImportCandidates campaignId={campaignId} />
        </div>
      }
    >
      {error && <p className="mb-3 text-label-13 text-red-900">{error}</p>}
      {candidates.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-alpha-500 p-5 text-copy-14 text-gray-900">
          No candidates yet. Import a CSV with each person’s First Name, Last Name, Title, Company and LinkedIn URL.
        </p>
      ) : (
        <div className="material-base overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="border-b border-gray-alpha-400">
              <tr>
                <th className="w-10 py-3 pl-4">
                  <input
                    type="checkbox"
                    aria-label="Select all candidates"
                    checked={selected.length === candidates.length}
                    onChange={(e) => setSelected(e.target.checked ? candidates.map((c) => c.id) : [])}
                  />
                </th>
                <th className={th}>Candidate</th>
                <th className={th}>LinkedIn</th>
                <th className={th}>Fields</th>
                <th className={th}>Work History</th>
                <th className={th}>Invitation Plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-alpha-400">
              {candidates.map((c) => {
                const missing = missingFields(c);
                return (
                  <tr key={c.id} className="align-top">
                    <td className="py-3.5 pl-4">
                      <input
                        type="checkbox"
                        aria-label={`Select ${name(c)}`}
                        checked={selected.includes(c.id)}
                        onChange={() => setSelected(selected.includes(c.id) ? selected.filter((x) => x !== c.id) : [...selected, c.id])}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-label-14 font-medium">{name(c)}</p>
                      <p className="text-label-12 text-gray-900">{[c.title, c.company].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className="px-4 py-3.5 text-label-13">
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="font-mono text-blue-900 hover:underline">
                          {c.linkedin_url.replace(/^https:\/\/www\.linkedin\.com/, "")}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      {missing.length ? <Status color="red">Missing {missing.join(", ")}</Status> : <Status color="green">Complete</Status>}
                    </td>
                    <td className="px-4 py-3">
                      {working("history", c) ? (
                        <span className="text-label-13 text-gray-900">Fetching from Sumble…</span>
                      ) : c.experience === null ? (
                        <Button disabled={!!busy || !ready.history(c)} onClick={() => run("history", [c.id])}>Generate</Button>
                      ) : !c.sumble_person_id ? (
                        <span className="text-label-13 text-gray-900">Not found in Sumble</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label={`View ${name(c)}’s work history`}
                            onClick={() => show(`${name(c)} · Work History`, <pre className="mt-4 max-h-[60vh] overflow-auto rounded-lg bg-background-200 p-4 font-mono text-label-12">{JSON.stringify(c.experience, null, 2)}</pre>)}
                            className="h-7 rounded-md px-2.5 font-mono text-label-13 shadow-border hover:bg-gray-100"
                          >
                            …
                          </button>
                          <span className="text-label-12 text-gray-900">{c.experience.length} {c.experience.length === 1 ? "role" : "roles"}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {working("plan", c) ? (
                        <span className="text-label-13 text-gray-900">Matching warm contacts…</span>
                      ) : c.warm_overlaps === null ? (
                        <Button disabled={!!busy || !ready.plan(c)} onClick={() => run("plan", [c.id])}>Generate Invitation Plan</Button>
                      ) : c.warm_overlaps.length === 0 ? (
                        <span className="text-label-13 text-gray-900">No overlapping warm contact</span>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1">
                            {[...new Set(c.warm_overlaps.map((o) => o.route))].map((r) => <Badge key={r} variant="inverted">{r}</Badge>)}
                          </div>
                          <p className="text-label-12"><strong>{c.warm_overlaps[0].warm_contact}</strong> · {sameCompany(c.warm_overlaps[0])}</p>
                          {c.warm_overlaps.length > 1 && (
                            <button
                              type="button"
                              onClick={() => show(`${name(c)} · Warm Contacts`, <OverlapList overlaps={c.warm_overlaps!} />)}
                              className="text-label-12 font-medium text-blue-900 hover:underline"
                            >
                              +{c.warm_overlaps.length - 1} more
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal ref={dialog} title={view?.title}>
        {view?.body}
        <div className="mt-6 flex justify-end"><Button onClick={() => dialog.current!.close()}>Close</Button></div>
      </Modal>
    </Section>
  );
}

function OverlapList({ overlaps }: { overlaps: Overlap[] }) {
  return (
    <ul className="mt-4 divide-y divide-gray-alpha-400 rounded-lg shadow-border">
      {overlaps.map((o) => (
        <li key={`${o.warm_contact}|${o.company}`} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="text-label-14 font-medium">{o.warm_contact}</p>
            <p className="text-label-12 text-gray-900">{sameCompany(o)}</p>
          </div>
          <Badge variant="inverted">{o.route}</Badge>
        </li>
      ))}
    </ul>
  );
}
