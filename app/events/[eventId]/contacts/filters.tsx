"use client";

import { useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

// The Accounts filters, kept in the URL: ?engagement= (none or engaged), applied on the server as it narrows the
// executives; and, applied in the browser since they only narrow the accounts already listed (see AccountBrowser),
// ?accounts= (ids picked in the search), ?selected= (none: accounts with no candidates yet; some: those with) and ?ae=
// (an AE's accounts, or none: those with no AE, which BDRs work).
const select = "h-8 rounded-lg bg-background-100 px-2.5 text-label-13 shadow-border";
type Option = { id: string; name: string };

// The URL with one parameter set (or removed when empty).
export function useHref() {
  const path = usePathname();
  const params = useSearchParams();
  return (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    return `${path}${next.size ? `?${next}` : ""}`;
  };
}

export const pickedIn = (params: URLSearchParams) => params.get("accounts")?.split(",").filter(Boolean) ?? [];

export default function Filters({ aes, accounts }: { aes: Option[]; accounts: Option[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const href = useHref();
  const go = (name: string, value: string) => router.replace(href(name, value), { scroll: false });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <AccountSearch accounts={accounts} />
      <select aria-label="Candidates selected" className={select} value={params.get("selected") ?? ""} onChange={(e) => window.history.replaceState(null, "", href("selected", e.target.value))}>
        <option value="">All Accounts</option>
        <option value="none">No Candidates Selected</option>
        <option value="some">Candidates Selected</option>
      </select>
      <select aria-label="AE" className={select} value={params.get("ae") ?? ""} onChange={(e) => window.history.replaceState(null, "", href("ae", e.target.value))}>
        <option value="">All AEs</option>
        {aes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        <option value="none">No AE (BDR accounts)</option>
      </select>
      <select aria-label="Prior engagement" className={select} value={params.get("engagement") ?? ""} onChange={(e) => go("engagement", e.target.value)}>
        <option value="">All Contacts</option>
        <option value="none">Cold Contacts Only</option>
        <option value="engaged">Warm Contacts Only</option>
      </select>
    </div>
  );
}

// Type to find an account, pick it (click, or arrows and Enter) and it becomes a chip; the list shows only the picked
// accounts. Backspace in an empty box removes the last chip. Like collapsing, it only hides rows, so no server trip.
function AccountSearch({ accounts }: { accounts: Option[] }) {
  const params = useSearchParams();
  const href = useHref();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const picked = pickedIn(params);
  const name = (id: string) => accounts.find((a) => a.id === id)?.name ?? "Unknown account";
  const set = (ids: string[]) => window.history.replaceState(null, "", href("accounts", ids.join(",")));
  const matches = accounts.filter((a) => !picked.includes(a.id) && a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const shown = open && matches.length > 0;
  const pick = (a: Option) => {
    set([...picked, a.id]);
    setQuery("");
    setActive(0);
  };
  return (
    <div className="relative">
      <div className="flex min-h-8 w-72 flex-wrap items-center gap-1 rounded-lg bg-background-100 px-1.5 py-1 shadow-border">
        {picked.map((id) => (
          <span key={id} className="inline-flex h-6 items-center gap-0.5 rounded-md bg-gray-200 pr-0.5 pl-2 text-label-12 font-medium">
            {name(id)}
            <button type="button" aria-label={`Remove ${name(id)}`} onClick={() => set(picked.filter((x) => x !== id))} className="grid size-5 cursor-pointer place-items-center rounded text-gray-900 hover:bg-gray-300 hover:text-gray-1000">
              ×
            </button>
          </span>
        ))}
        <input
          role="combobox"
          aria-label="Search accounts"
          aria-expanded={shown}
          aria-controls={listId}
          aria-activedescendant={shown ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={picked.length ? "Add account…" : "Search accounts…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + matches.length) % Math.max(matches.length, 1));
            } else if (e.key === "Enter" && shown) {
              e.preventDefault();
              pick(matches[Math.min(active, matches.length - 1)]);
            } else if (e.key === "Escape") setOpen(false);
            else if (e.key === "Backspace" && !query && picked.length) set(picked.slice(0, -1));
          }}
          className="h-6 min-w-24 flex-1 bg-transparent px-1 text-label-13 outline-none placeholder:text-gray-900"
        />
      </div>
      {shown && (
        <ul id={listId} role="listbox" aria-label="Accounts" className="material-medium absolute top-full left-0 z-10 mt-1 max-h-64 w-72 overflow-auto p-1">
          {matches.map((a, i) => (
            <li
              key={a.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, not click, so the pick lands before the input's blur closes the list
              onMouseDown={(e) => {
                e.preventDefault();
                pick(a);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer truncate rounded-md px-2 py-1.5 text-label-13 ${i === active ? "bg-gray-200" : ""}`}
            >
              {a.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
