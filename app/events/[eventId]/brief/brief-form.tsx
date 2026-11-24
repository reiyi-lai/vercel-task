"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import { Button, Status } from "@/components/ui";
import { CITIES, GEOGRAPHY, LEAD_SENDER, OUTREACH_LEADS, SENDER_LABEL, SENIORITY, THEMES, TIERS, VERTICALS, outreachVolume } from "@/lib/brief";
import type { EventBrief, SequenceStep } from "@/lib/data";
import { PLACEHOLDERS } from "@/lib/sequence";
import { createEvent, saveBrief } from "./actions";

// box: sized by its caller (inline controls); control: full width.
const box = "h-9 rounded-lg bg-background-100 px-3 text-label-14 shadow-border";
const control = `${box} w-full`;
const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);
const wholeNumber = (v: string) => /^\d+$/.test(v) && Number(v) >= 1;
const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

type Props = {
  brief: EventBrief;
  event: { slug: string; name?: string; shortName?: string; startDate: string; endDate: string | null; seats: number | null };
  confirmed: number; // guests already confirmed in Salesforce
  create?: boolean; // a new event: also asks for its name, and Save creates it
};

// The Event Brief: the event's details, who the agent should find, how many to invite, and the outreach sequence.
// Dates and capacity live on the Salesforce campaign and the event; the rest on the brief. A one-day event has no end date.
export default function BriefForm({ brief, event, confirmed, create }: Props) {
  const initial = { brief, date: event.startDate, endDate: event.endDate ?? "", seats: event.seats?.toString() ?? "", guests: brief.target_guests.toString() };
  const [saved, setSaved] = useState(initial);
  const [b, setB] = useState(brief);
  const [date, setDate] = useState(initial.date);
  const [endDate, setEndDate] = useState(initial.endDate);
  const [seats, setSeats] = useState(initial.seats);
  const [guests, setGuests] = useState(initial.guests);
  const [personas, setPersonas] = useState(brief.personas.join(", "));
  const [name, setName] = useState(event.name ?? "");
  const [shortName, setShortName] = useState(event.shortName ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<EventBrief>) => setB({ ...b, ...patch });
  const current = { brief: b, date, endDate, seats, guests };
  const dirty = create || JSON.stringify(current) !== JSON.stringify(saved);
  const invalid =
    create && (!name.trim() || !shortName.trim()) ? "Enter the event’s name and short name."
    : !isDate(date) ? "Enter a valid start date."
    : endDate && (!isDate(endDate) || endDate < date) ? "The end date must be on or after the start date."
    : seats && !wholeNumber(seats) ? "Capacity must be a whole number of seats."
    : !wholeNumber(guests) ? "Target confirmed guests must be a whole number."
    : null;
  const volume = outreachVolume(b, confirmed);

  const save = () =>
    startTransition(async () => {
      const details = { date, endDate: endDate || null, seats: seats ? Number(seats) : null };
      const err = create ? await createEvent(b, details, { name, shortName }) : await saveBrief(b, details);
      setError(err);
      if (!err) setSaved(current);
    });
  const discard = () => {
    setB(saved.brief);
    setDate(saved.date);
    setEndDate(saved.endDate);
    setSeats(saved.seats);
    setGuests(saved.guests);
    setPersonas(saved.brief.personas.join(", "));
  };

  return (
    <div className="space-y-4">
      <div className="material-medium space-y-6 p-6">
        <div className="grid gap-4 rounded-xl bg-gray-100 p-4 sm:grid-cols-2">
          {create && (
            <>
              <Detail label="Event Name">
                <input required placeholder="e.g. Las Vegas Grand Prix" className={control} value={name} onChange={(e) => setName(e.target.value)} />
              </Detail>
              <Detail label="Short Name">
                <input required placeholder="e.g. Las Vegas GP" className={control} value={shortName} onChange={(e) => setShortName(e.target.value)} />
              </Detail>
            </>
          )}
          <Detail label="Format">
            <input className={control} value={b.format ?? ""} onChange={(e) => set({ format: e.target.value || null })} />
          </Detail>
          <Detail label="Location">
            <input className={control} value={b.location ?? ""} onChange={(e) => set({ location: e.target.value || null })} />
          </Detail>
          <div className="grid grid-cols-2 gap-3">
            <Detail label="Start Date">
              <input type="date" required className={control} value={date} onChange={(e) => setDate(e.target.value)} />
            </Detail>
            <Detail label="End Date (optional)">
              <input type="date" min={date} className={control} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Detail>
          </div>
          <Detail label="Capacity (seats)">
            <input type="number" min={1} step={1} inputMode="numeric" placeholder="Not specified" className={control} value={seats} onChange={(e) => setSeats(e.target.value)} />
          </Detail>
        </div>

        <Group n="01" title="Audience & Targeting">
          <div className="grid gap-5 sm:grid-cols-2 sm:max-w-xl">
            <Field label="Target Verticals">
              <OneOrAll label="Target Verticals" options={VERTICALS} value={b.verticals} onChange={(verticals) => set({ verticals })} />
            </Field>
            <Field label="Target Horizontals">
              <OneOrAll label="Target Horizontals" options={THEMES} value={b.themes} onChange={(themes) => set({ themes })} />
            </Field>
          </div>
          <Field label="Target Personas" hint="Comma-separated titles or functions.">
            <input
              className={control}
              value={personas}
              onChange={(e) => {
                setPersonas(e.target.value);
                set({ personas: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) });
              }}
            />
          </Field>
          <Field label="Location">
            <Radios options={GEOGRAPHY} value={b.geography} onChange={(geography) => set({ geography })} />
            {b.geography === "city" && (
              <div className="space-y-2 pt-1">
                <select
                  aria-label="Add a city"
                  className={`${control} sm:w-64`}
                  value=""
                  onChange={(e) => e.target.value && set({ cities: [...b.cities, e.target.value] })}
                >
                  <option value="">Add a city…</option>
                  {CITIES.filter((c) => !b.cities.includes(c)).map((c) => <option key={c}>{c}</option>)}
                </select>
                {b.cities.length > 0 && (
                  <ul className="flex flex-wrap gap-2">
                    {b.cities.map((c) => (
                      <li key={c} className="flex h-7 items-center gap-1 rounded-lg pl-2.5 pr-1 text-label-13 shadow-border">
                        {c}
                        <button type="button" aria-label={`Remove ${c}`} onClick={() => set({ cities: b.cities.filter((x) => x !== c) })} className="flex size-5 items-center justify-center rounded text-gray-900 hover:bg-gray-100 hover:text-gray-1000">×</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Field>
          <Field label="Minimum Seniority">
            <select className={`${control} sm:w-64`} value={b.min_seniority} onChange={(e) => set({ min_seniority: e.target.value as EventBrief["min_seniority"] })}>
              {Object.entries(SENIORITY).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </Field>
          <Field label="Target Account Tier">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {TIERS.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-label-14">
                  <input type="checkbox" className="size-4 accent-gray-1000" checked={b.tiers.includes(t)} onChange={() => set({ tiers: toggle(b.tiers, t) })} />
                  {t}
                </label>
              ))}
            </div>
          </Field>
        </Group>

        <Group n="02" title="Attendance & Outreach Planning">
          <label className="block space-y-2 sm:w-64">
            <span className="text-label-13 font-medium">Candidate Selection Deadline</span>
            <input type="date" max={date || undefined} className={control} value={b.select_by ?? ""} onChange={(e) => set({ select_by: e.target.value || null })} />
            <span className="block text-label-12 text-gray-900">AE/BDRs to select candidates by this date.</span>
          </label>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-label-13 font-medium">Target Confirmed Guests</span>
              <input
                type="number" min={1} step={1} inputMode="numeric" className={control} value={guests}
                onChange={(e) => {
                  setGuests(e.target.value);
                  if (wholeNumber(e.target.value)) set({ target_guests: Number(e.target.value) });
                }}
              />
            </label>
            <Slider label="Expected Acceptance Rate" value={b.acceptance_rate} min={10} max={90} step={5} unit="%" onChange={(acceptance_rate) => set({ acceptance_rate })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["Invitations to Send", volume.invites, `${confirmed} already confirmed in Salesforce`],
              ["Expected Guests", volume.expected, `Target ${b.target_guests}`],
            ].map(([label, n, note]) => (
              <div key={label} className="rounded-xl p-4 shadow-border">
                <p className="text-label-12 text-gray-900">{label}</p>
                <p className="mt-1 text-heading-24">{n}</p>
                <p className="text-label-12 text-gray-900">{note}</p>
              </div>
            ))}
          </div>
        </Group>

        <Group n="03" title="Outreach Sequence">
          <Radios
            options={OUTREACH_LEADS}
            value={b.outreach_lead}
            // The lead sets who sends every step.
            onChange={(outreach_lead) => set({ outreach_lead, sequence: b.sequence.map((x) => ({ ...x, sender: LEAD_SENDER[outreach_lead] })) })}
          />
          <p className="text-label-12 text-gray-900">Placeholders: {PLACEHOLDERS.map((x) => `{${x}}`).join(" ")}</p>
          <ol className="space-y-3">
            {b.sequence.map((step, i) => {
              const setStep = (patch: Partial<SequenceStep>) => set({ sequence: b.sequence.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <li key={i} className="space-y-4 rounded-xl p-4 shadow-border">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="flex h-9 items-center text-label-14 font-medium">Step {i + 1}</span>
                    <label className="flex items-center gap-1.5 text-label-13 text-gray-900">
                      Day
                      <input type="number" min={0} value={step.day} onChange={(e) => setStep({ day: Number(e.target.value) })} className={`${box} w-20`} />
                    </label>
                    <select aria-label="Channel" value={step.channel} onChange={(e) => setStep({ channel: e.target.value as SequenceStep["channel"] })} className={`${box} w-32`}>
                      {["Email", "LinkedIn", "Phone"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <p className="flex h-9 items-center text-label-13 text-gray-900">{SENDER_LABEL[step.sender]}</p>
                    {/* The exec is named once, on the first Exec step; later ones show who it is. */}
                    {step.sender === "Exec" && (b.sequence.findIndex((x) => x.sender === "Exec") === i ? (
                      <input aria-label="Vercel Exec’s name" placeholder="Vercel Exec’s name…" value={b.exec_name ?? ""} onChange={(e) => set({ exec_name: e.target.value || null })} className={`${box} w-56`} />
                    ) : (
                      <p className="flex h-9 items-center text-label-13 text-gray-900">·&nbsp;<span className="text-gray-1000">{b.exec_name || "Exec named in Step 1"}</span></p>
                    ))}
                    <Button className="ml-auto" onClick={() => set({ sequence: b.sequence.filter((_, j) => j !== i) })}>Remove</Button>
                  </div>
                  <div className="space-y-2">
                    {step.channel === "Email" && (
                      <input aria-label="Subject" placeholder="Subject" value={step.subject} onChange={(e) => setStep({ subject: e.target.value })} className={control} />
                    )}
                    <textarea aria-label="Message" rows={5} value={step.body} onChange={(e) => setStep({ body: e.target.value })} className="w-full rounded-lg bg-background-100 px-3 py-2 text-copy-13 shadow-border" />
                  </div>
                </li>
              );
            })}
          </ol>
          <Button
            onClick={() => {
              const last = b.sequence.at(-1);
              set({ sequence: [...b.sequence, { day: (last?.day ?? -3) + 3, channel: "Email", sender: LEAD_SENDER[b.outreach_lead], subject: "", body: "Hi {first_name},\n\n\n\n{sender_name}" }] });
            }}
          >
            Add Step
          </Button>
        </Group>
      </div>

      <div className="material-medium sticky bottom-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        {error || invalid ? (
          <p className={`text-label-13 ${error || !create ? "text-red-900" : "text-gray-900"}`}>{error ?? invalid}</p>
        ) : dirty ? (
          <Status color="amber">Unsaved changes</Status>
        ) : (
          <Status color="green">Saved</Status>
        )}
        <div className="flex gap-2">
          {dirty && !create && <Button onClick={discard} disabled={pending}>Discard</Button>}
          <Button variant="primary" onClick={save} disabled={!dirty || pending || !!invalid}>
            {create ? (pending ? "Creating…" : "Create Event") : pending ? "Saving…" : "Save Brief"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-label-12 text-gray-900">{label}</span>
      {children}
    </label>
  );
}

function Group({ n, title, description, children }: { n: string; title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-5 border-t border-gray-alpha-400 pt-6">
      <div>
        <h3 className="text-heading-16">{n} · {title}</h3>
        {description && <p className="mt-1 text-copy-13 text-gray-900">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-label-13 font-medium">{label}</legend>
      {children}
      {hint && <p className="text-label-12 text-gray-900">{hint}</p>}
    </fieldset>
  );
}

// A dropdown of All or one option. The value is the options it covers: every one for All, else the one chosen.
function OneOrAll({ label, options, value, onChange }: { label: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const current = options.every((o) => value.includes(o)) ? "All" : value[0] ?? "All";
  return (
    <select aria-label={label} className={control} value={current} onChange={(e) => onChange(e.target.value === "All" ? options : [e.target.value])}>
      <option>All</option>
      {options.map((o) => <option key={o}>{o}</option>)}
    </select>
  );
}

// Each group gets its own name from useId. Next keeps pages you've left mounted but hidden (Activity), so a second
// brief can sit in the document; radios sharing a name across both would uncheck each other.
function Radios<T extends string>({ options, value, onChange }: { options: Record<T, string | { label: string; detail: string }>; value: T; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <div className="space-y-2.5">
      {(Object.entries(options) as [T, string | { label: string; detail: string }][]).map(([v, o]) => (
        <label key={v} className="flex cursor-pointer items-start gap-3">
          <input type="radio" name={name} className="mt-0.5 size-4 shrink-0 cursor-pointer appearance-none rounded-full border border-gray-alpha-500 bg-background-100 checked:border-[5px] checked:border-gray-1000 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" checked={value === v} onChange={() => onChange(v)} />
          <span>
            <span className="text-label-14">{typeof o === "string" ? o : o.label}</span>
            {typeof o !== "string" && <span className="block text-label-12 text-gray-900">{o.detail}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function Slider({ label, value, min, max, step, unit = "", onChange }: { label: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (v: number) => void }) {
  return (
    <label className="block space-y-2">
      <span className="flex justify-between text-label-13">
        <span className="font-medium">{label}</span>
        <span>{value}{unit}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} className="w-full accent-gray-1000" onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}
