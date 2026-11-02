"use client";

import { parse } from "csv-parse/browser/esm/sync";
import { useRef, useState, useTransition } from "react";
import { Button, Modal, Status } from "@/components/ui";
import { CANDIDATE_FIELDS, guessMapping, missingFields, toCandidate, type Mapping } from "@/lib/candidates";
import { importCandidates } from "./actions";

// Import CSV: pick a file, check which column fills each field (guessed from the headers), then import.
// Rows missing a required field still import, flagged in the table.
export default function ImportCandidates({ campaignId }: { campaignId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: Record<string, string>[] }>();
  const [mapping, setMapping] = useState<Mapping>();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const pick = async (f: File) => {
    const rows: Record<string, string>[] = parse(await f.text(), { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const headers = Object.keys(rows[0] ?? {});
    setFile({ name: f.name, headers, rows });
    setMapping(guessMapping(headers));
    setError(undefined);
    dialog.current!.showModal();
  };
  const candidates = file && mapping ? file.rows.map((r) => toCandidate(r, mapping)) : [];
  const flagged = candidates.filter((c) => missingFields(c).length).length;
  const submit = () =>
    startTransition(async () => {
      const err = await importCandidates(campaignId, candidates);
      if (err) setError(err);
      else dialog.current!.close();
    });

  return (
    <>
      <input ref={input} type="file" accept=".csv,text/csv" hidden onChange={(e) => { if (e.target.files?.[0]) pick(e.target.files[0]); e.target.value = ""; }} />
      <Button variant="primary" onClick={() => input.current!.click()}>Import CSV</Button>
      <Modal ref={dialog} title="Import Candidates">
        {file && mapping && (
          <>
            <p className="mt-1 text-copy-14 text-gray-900">{file.name} · {file.rows.length} {file.rows.length === 1 ? "row" : "rows"}. Check which column fills each field.</p>
            <div className="mt-4 divide-y divide-gray-alpha-400 rounded-lg shadow-border">
              {CANDIDATE_FIELDS.map((f) => (
                <label key={f.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="text-label-14">
                    {f.label}
                    {!f.required && <span className="text-gray-900"> (optional)</span>}
                  </span>
                  <span className="flex items-center gap-3">
                    {f.required && !mapping[f.key] && <Status color="red">Not in file</Status>}
                    <select
                      value={mapping[f.key]}
                      onChange={(e) => setMapping({ ...mapping, [f.key]: e.target.value })}
                      className="h-8 w-48 rounded-lg bg-background-100 px-2 text-label-13 shadow-border"
                    >
                      <option value="">—</option>
                      {file.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </span>
                </label>
              ))}
            </div>
            <div className="mt-4">
              {flagged ? (
                <Status color="amber">{flagged} of {candidates.length} rows are missing a required field and will import flagged.</Status>
              ) : (
                <Status color="green">Every row has the required fields.</Status>
              )}
            </div>
            {error && <p className="mt-3 text-label-13 text-red-900">{error}</p>}
          </>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={() => dialog.current!.close()}>Cancel</Button>
          <Button variant="primary" onClick={submit} disabled={pending || !candidates.length}>
            {pending ? "Importing…" : `Import ${candidates.length} ${candidates.length === 1 ? "Candidate" : "Candidates"}`}
          </Button>
        </div>
      </Modal>
    </>
  );
}
