"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Esc closes the candidate panel, like a dialog.
export default function PanelEscape({ close }: { close: string }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && router.push(close, { scroll: false });
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [close, router]);
  return null;
}
