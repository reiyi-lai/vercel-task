"use client";

import { createContext, use, useState, type ReactNode } from "react";

// Multi-select for a list: rows tick into a shared set, and a bulk action (Remove Selected, Add Candidates) reads it.
const Selection = createContext<{ ids: Set<string>; toggle: (id: string) => void; clear: () => void } | null>(null);

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState(new Set<string>());
  const toggle = (id: string) => setIds((s) => (s.has(id) ? new Set([...s].filter((x) => x !== id)) : new Set(s).add(id)));
  return <Selection value={{ ids, toggle, clear: () => setIds(new Set()) }}>{children}</Selection>;
}

export const useSelection = () => use(Selection)!;

export function SelectCheckbox({ id, name }: { id: string; name: string }) {
  const { ids, toggle } = useSelection();
  return <input type="checkbox" aria-label={`Select ${name}`} className="size-4 shrink-0 accent-gray-1000" checked={ids.has(id)} onChange={() => toggle(id)} />;
}
