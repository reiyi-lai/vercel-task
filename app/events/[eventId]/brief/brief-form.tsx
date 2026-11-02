"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import { Button, Status, TabLinks } from "@/components/ui";
import { CITIES, GEOGRAPHY, OBJECTIVES, RADII, SEARCH_SCOPE, SENIORITY, THEMES, TIERS, VERTICALS, outreachVolume } from "@/lib/brief";
import type { EventBrief, SequenceStep } from "@/lib/data";
import { PLACEHOLDERS } from "@/lib/sequence";
import { saveBrief } from "./actions";

const control = "h-9 w-full rounded-lg bg-background-100 px-3 text-label-14 shadow-border";
const toggle = (list: string[], x: string) => (list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

type Props = {
  brief: EventBrief;
  event: { slug: string; name: string; date: string; seats: number | null };
  events: { slug: string; name: string }[];
  confirmed: number; // guests already confirmed in Salesforce
};

// The Event Brief: who the agent should find for this event, how to rank them, and how many to invite.
export default function BriefForm({ brief, event, events, confirmed }: Props) {
  const router = useRouter();
  const [saved, setSaved] = useState(brief);
  const [b, setB] = useState(brief);
  const [personas, setPersonas] = useState(brief.personas.join(", "));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const set = (patch: Partial<EventBrief>) => setB({ ...b, ...patch });
  const dirty = JSON.stringify(b) !== JSON.stringify(saved);
  const volume = outreachVolume(b, confirmed);

  const save = () =>
    startTransition(async () => {
      const err = await saveBrief(b);
      setError(err);
      if (!err) setSaved(b);
    });
  const discard = () => {
    setB(saved);
    setPersonas(saved.personas.join(", "));
  };

  return (
    <div className="space-y-4">
      <div className="material-medium space-y-6 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-label-12 font-medium uppercase tracking-wide text-gray-900">Event Prospecting / Setup</p>
            <h2 className="mt-1 text-heading-24">Event Brief</h2>
          </div>
          <label className="block w-full space-y-1.5 sm:w-96">
            <span className="text-label-13 text-gray-900">Event</span>
            <select
              className={control}
              value={event.slug}
              onChange={(e) => (!dirty || confirm("Discard unsaved changes to this brief?")) && router.push(`/events/${e.target.value}/brief`)}
            >
              {events.map((e) => <option key={e.slug} value={e.slug}>{e.name}</option>)}
            </select>
          </label>
        </div>

        <dl className="grid gap-4 rounded-xl bg-gray-100 p-4 sm:grid-cols-2">
          {[
            ["Format", b.format],
            ["Location", b.location],
            ["Date", event.date],
            ["Capacity", event.seats ? `${event.seats} executive seats` : "Not specified"],
            ["Purpose", b.purpose],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-label-12 text-gray-900">{label}</dt>
              <dd className="mt-0.5 text-label-14 font-medium">{value}</dd>
            </div>
          ))}
        </dl>

        <Group n="01" title="Audience & Targeting" description="Defines which accounts and executives qualify.">
          <Field label="Target Verticals">
            <Chips options={VERTICALS} value={b.verticals} onChange={(verticals) => set({ verticals })} />
          </Field>
          <Field label="Campaign Themes">
            <Chips options={THEMES} value={b.themes} onChange={(themes) => set({ themes })} />
          </Field>
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
          <Field label="Geography">
            <Radios name="geography" options={GEOGRAPHY} value={b.geography} onChange={(geography) => set({ geography })} />
            {b.geography !== "nationwide" && (
              <div className="grid gap-3 pt-1 sm:grid-cols-2">
                <label className="block space-y-1.5">
                  <span className="text-label-13 text-gray-900">Target City</span>
                  <select className={control} value={b.city ?? ""} onChange={(e) => set({ city: e.target.value })}>
                    {Object.keys(CITIES).map((c) => <option key={c}>{c}</option>)}
                  </select>
                </label>
                {b.geography === "regional" && (
                  <label className="block space-y-1.5">
                    <span className="text-label-13 text-gray-900">Radius</span>
                    <select className={control} value={b.radius_miles ?? ""} onChange={(e) => set({ radius_miles: Number(e.target.value) })}>
                      {RADII.map((r) => <option key={r} value={r}>Within {r} miles</option>)}
                    </select>
                  </label>
                )}
              </div>
            )}
          </Field>
          <Field
            label="Minimum Seniority"
            hint={b.seniority_mode === "gate" ? "Candidates below the minimum are excluded before ranking." : "Candidates below the minimum stay eligible but rank lower on event fit."}
          >
            <div className="flex flex-wrap items-center gap-3">
              <select className={`${control} sm:w-64`} value={b.min_seniority} onChange={(e) => set({ min_seniority: e.target.value as EventBrief["min_seniority"] })}>
                {Object.entries(SENIORITY).map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <Segmented options={[["preference", "Preference"], ["gate", "Hard Gate"]]} value={b.seniority_mode} onChange={(seniority_mode) => set({ seniority_mode })} />
            </div>
          </Field>
          <Field label="Target Segment" hint="Uses the segment assigned to the account in the CRM.">
            <Segmented options={[["both", "Both"], ["majors", "Majors"], ["commercial", "Commercial"]]} value={b.segment} onChange={(segment) => set({ segment })} />
          </Field>
          <Field
            label="Target Account Tier"
            hint={b.tier_mode === "only" ? "Accounts outside the selected tiers are excluded." : "Selected tiers rank higher; other enterprise accounts stay eligible."}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              {TIERS.map((t) => (
                <label key={t} className="flex cursor-pointer items-center gap-2 text-label-14">
                  <input type="checkbox" className="size-4 accent-gray-1000" checked={b.tiers.includes(t)} onChange={() => set({ tiers: toggle(b.tiers, t) })} />
                  {t}
                </label>
              ))}
              <Segmented options={[["prefer", "Prioritize Selected"], ["only", "Only Selected Tiers"]]} value={b.tier_mode} onChange={(tier_mode) => set({ tier_mode })} />
            </div>
          </Field>
          <p className="text-label-12 text-gray-900">Enterprise scope: 5,000+ employees. Current roles are verified, and duplicate or suppressed contacts are skipped.</p>
        </Group>

        <Group n="02" title="Prioritization" description="Decides who ranks higher among the executives who qualify.">
          <Field label="Primary Commercial Objective">
            <Radios name="objective" options={OBJECTIVES} value={b.objective} onChange={(objective) => set({ objective })} />
          </Field>
          <Field label="Scoring Weights">
            <div className="space-y-3 rounded-xl bg-gray-100 p-4">
              <div className="flex justify-between text-label-13">
                <span>Account Value {b.account_weight}%</span>
                <span>Executive Relevance {100 - b.account_weight}%</span>
              </div>
              <div aria-hidden className="flex h-2 gap-1">
                <span className="rounded-full bg-gray-700" style={{ width: `${b.account_weight}%` }} />
                <span className="flex-1 rounded-full bg-gray-1000" />
              </div>
              <input
                type="range" min={20} max={80} step={5} aria-label="Account value weight" className="w-full accent-gray-1000"
                value={b.account_weight} onChange={(e) => set({ account_weight: Number(e.target.value) })}
              />
              <p className="text-label-12 text-gray-900">Account value: tier, opportunity context and relevant signals. Executive relevance: functional ownership, buying influence and event fit.</p>
            </div>
          </Field>
        </Group>

        <Group n="03" title="Attendance & Outreach Planning" description="Works back from the guest target to how many executives to find.">
          <div className="grid gap-5 sm:grid-cols-3">
            <Slider label="Target Confirmed Guests" value={b.target_guests} min={2} max={60} step={1} onChange={(target_guests) => set({ target_guests })} />
            <Slider label="Expected Acceptance Rate" value={b.acceptance_rate} min={10} max={90} step={5} unit="%" onChange={(acceptance_rate) => set({ acceptance_rate })} />
            <Slider label="Expected Shortlist Approval" value={b.approval_rate} min={40} max={100} step={5} unit="%" onChange={(approval_rate) => set({ approval_rate })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              ["Executives to Shortlist", volume.shortlist, "For BDR and AE review"],
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
          <p className="text-copy-13 text-gray-900">
            {volume.invites
              ? `Find about ${volume.shortlist} qualified executives so ${volume.invites} approved invitations can reach ${b.target_guests} guests, at ${b.approval_rate}% approval and ${b.acceptance_rate}% acceptance. Send them in waves rather than all at once.`
              : "The guest target is already met by confirmed guests."}
          </p>
        </Group>

        <Group n="04" title="Search Scope">
          <Field label="Prospecting Data">
            <Radios name="search_scope" options={SEARCH_SCOPE} value={b.search_scope} onChange={(search_scope) => set({ search_scope })} />
          </Field>
          <p className="text-label-12 text-gray-900">Duplicate event invitations and suppressed contacts are always excluded.</p>
        </Group>

        <Group n="05" title="Sequence & Copy" description="The outreach steps every candidate for this event gets, with template copy. Each candidate’s invitation page fills it in.">
          <p className="text-label-12 text-gray-900">Placeholders: {PLACEHOLDERS.map((x) => `{${x}}`).join(" ")}</p>
          <ol className="space-y-3">
            {b.sequence.map((step, i) => {
              const setStep = (patch: Partial<SequenceStep>) => set({ sequence: b.sequence.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
              return (
                <li key={i} className="space-y-2 rounded-xl p-4 shadow-border">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-label-14 font-medium">Step {i + 1}</span>
                    <label className="flex items-center gap-1.5 text-label-13 text-gray-900">
                      Day
                      <input type="number" min={0} value={step.day} onChange={(e) => setStep({ day: Number(e.target.value) })} className={`${control} w-20`} />
                    </label>
                    <select aria-label="Channel" value={step.channel} onChange={(e) => setStep({ channel: e.target.value as SequenceStep["channel"] })} className={`${control} w-32`}>
                      {["Email", "LinkedIn", "Phone"].map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <select aria-label="Sender" value={step.sender} onChange={(e) => setStep({ sender: e.target.value as SequenceStep["sender"] })} className={`${control} w-28`}>
                      <option value="AE">From AE</option>
                      <option value="BDR">From BDR</option>
                    </select>
                    <Button className="ml-auto" onClick={() => set({ sequence: b.sequence.filter((_, j) => j !== i) })}>Remove</Button>
                  </div>
                  {step.channel === "Email" && (
                    <input aria-label="Subject" placeholder="Subject" value={step.subject} onChange={(e) => setStep({ subject: e.target.value })} className={control} />
                  )}
                  <textarea aria-label="Message" rows={5} value={step.body} onChange={(e) => setStep({ body: e.target.value })} className="w-full rounded-lg bg-background-100 px-3 py-2 text-copy-13 shadow-border" />
                </li>
              );
            })}
          </ol>
          <Button
            onClick={() => {
              const last = b.sequence.at(-1);
              set({ sequence: [...b.sequence, { day: (last?.day ?? -3) + 3, channel: "Email", sender: last?.sender ?? "AE", subject: "", body: "Hi {first_name},\n\n\n\n{sender_first_name}" }] });
            }}
          >
            Add Step
          </Button>
        </Group>
      </div>

      <div className="material-medium sticky bottom-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        {error ? (
          <p className="text-label-13 text-red-900">{error}</p>
        ) : dirty ? (
          <Status color="amber">Unsaved changes</Status>
        ) : (
          <Status color="green">Saved</Status>
        )}
        <div className="flex gap-2">
          {dirty && <Button onClick={discard} disabled={pending}>Discard</Button>}
          <Button variant="primary" onClick={save} disabled={!dirty || pending}>{pending ? "Saving…" : "Save Brief"}</Button>
        </div>
      </div>
    </div>
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

function Chips({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          aria-pressed={value.includes(o)}
          onClick={() => onChange(toggle(value, o))}
          className={`h-8 rounded-lg px-3 text-label-13 ${value.includes(o) ? "bg-gray-1000 text-background-100" : "text-gray-900 shadow-border hover:text-gray-1000"}`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Radios<T extends string>({ name, options, value, onChange }: { name: string; options: Record<T, string | { label: string; detail: string }>; value: T; onChange: (v: T) => void }) {
  return (
    <div className="space-y-2.5">
      {(Object.entries(options) as [T, string | { label: string; detail: string }][]).map(([v, o]) => (
        <label key={v} className="flex cursor-pointer items-start gap-3">
          <input type="radio" name={name} className="mt-0.5 size-4 accent-gray-1000" checked={value === v} onChange={() => onChange(v)} />
          <span>
            <span className="text-label-14">{typeof o === "string" ? o : o.label}</span>
            {typeof o !== "string" && <span className="block text-label-12 text-gray-900">{o.detail}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function Segmented<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="inline-block">
      <TabLinks variant="segmented" items={options.map(([v, label]) => ({ label, active: v === value, onClick: () => onChange(v) }))} />
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
