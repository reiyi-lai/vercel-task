"use client";

import { useState, useTransition } from "react";
import { showSaved } from "./show-saved";

// Posts to one of Seatbook's API routes, then shows what it saved (showSaved re-renders the page with fresh data). Each
// button has its own request, so several run at once (Server Actions would queue one behind another; showSaved is
// instant, so queueing it costs nothing).
export function usePost<T extends { error?: string }>() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const post = (url: string, body: object, then?: (data: T) => void) =>
    startTransition(async () => {
      const data: T = await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      setError(data.error);
      then?.(data);
      if (!data.error) await showSaved();
    });
  return { pending, error, post };
}
