"use client";

import { createContext, use, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Status } from "@/components/ui";
import { pickedIn, useHref } from "./filters";

// The Accounts page's master–detail: a list of accounts on the left (each with whether it has candidates yet) and the
// chosen account's executives on the right. Every account's panel is already on the page, so choosing one (?account=)
// only changes which shows: no trip to the server. The AE filter (?ae=), the search (?accounts=) and the candidates filter
// (?selected=) narrow the list; the chosen account is the one asked for while it's listed, else the first listed.
// owner: the account's AE id, or "none" for accounts BDRs work.
export type Item = { id: string; name: string; tier: string | null; owner: string; qualified: number; selected: number };
const Browse = createContext<{ shown: Item[]; active: string | undefined } | null>(null);

export function AccountBrowser({ items, children }: { items: Item[]; children: ReactNode }) {
  const params = useSearchParams();
  const picked = pickedIn(params);
  const want = params.get("selected");
  const ae = params.get("ae");
  const shown = items.filter(
    (a) => (!ae || a.owner === ae) && (!picked.length || picked.includes(a.id)) && (want !== "none" || !a.selected) && (want !== "some" || a.selected)
  );
  const active = (shown.find((a) => a.id === params.get("account")) ?? shown[0])?.id;
  return <Browse value={{ shown, active }}>{children}</Browse>;
}

export function AccountList() {
  const { shown, active } = use(Browse)!;
  const href = useHref();
  if (!shown.length) return <p className="rounded-xl border border-dashed border-gray-alpha-500 p-4 text-label-13 text-gray-900">No accounts match these filters.</p>;
  return (
    <nav aria-label="Accounts" className="material-base overflow-hidden lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
      <ul className="divide-y divide-gray-alpha-400">
        {shown.map((a) => (
          <li key={a.id}>
            <button
              type="button"
              aria-current={a.id === active ? "true" : undefined}
              onClick={() => window.history.replaceState(null, "", href("account", a.id))}
              className={`block w-full cursor-pointer px-4 py-3 text-left ${a.id === active ? "bg-gray-200" : "hover:bg-gray-100"}`}
            >
              {/* Green once anyone here is picked, amber while no one is: the accounts still to cover stand out. */}
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="text-label-14 font-medium">{a.name}</span>
                {a.tier && <span className="text-label-13 text-gray-900">{a.tier}</span>}
              </span>
              <span className="mt-2 block">
                <Status color={a.selected ? "green" : "amber"}>
                  {a.selected ? `${a.selected} ${a.selected === 1 ? "candidate" : "candidates"} selected` : "No candidates selected"}
                  <span className="text-gray-900">&nbsp;· {a.qualified} qualified</span>
                </Status>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// One account's panel: shown while it's the chosen account.
export function AccountPanel({ id, children }: { id: string; children: ReactNode }) {
  return <div hidden={use(Browse)!.active !== id}>{children}</div>;
}
