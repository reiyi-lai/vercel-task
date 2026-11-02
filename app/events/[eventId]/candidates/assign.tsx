"use client";

import { useState, useTransition } from "react";

// A select that assigns someone (an AE to an account, a BDR to a candidate) through a bound Server Action.
export default function Assign({ label, options, value, action }: {
  label: string;
  options: { id: string; name: string }[];
  value: string | null;
  action: (userId: string | null) => Promise<string | undefined | void>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  return (
    <div className="space-y-1">
      <select
        aria-label={label}
        disabled={pending}
        value={value ?? ""}
        onChange={(e) => startTransition(async () => setError((await action(e.target.value || null)) ?? undefined))}
        className="h-8 w-full rounded-lg bg-background-100 px-2 text-label-13 shadow-border disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}
