"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

// Posts to one of Seatbook's API routes, then refreshes the page to show what it saved. Each button has its own
// request, so several run at once (Server Actions would queue one behind another).
export function usePost<T extends { error?: string }>() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const post = (url: string, body: object, then?: (data: T) => void) =>
    startTransition(async () => {
      const data: T = await (await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
      setError(data.error);
      then?.(data);
      if (!data.error) router.refresh();
    });
  return { pending, error, post };
}
