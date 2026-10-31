"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, type ReactNode } from "react";

// Shows the server-rendered view chosen by a URL search param, so tabs and filters deep-link.
export default function ParamSwitch({ name, views }: { name: string; views: Record<string, ReactNode> }) {
  const fallback = Object.values(views)[0];
  return (
    <Suspense fallback={fallback}>
      <Choose name={name} views={views} fallback={fallback} />
    </Suspense>
  );
}

function Choose({ name, views, fallback }: { name: string; views: Record<string, ReactNode>; fallback: ReactNode }) {
  const value = useSearchParams().get(name);
  return value && value in views ? views[value] : fallback;
}
