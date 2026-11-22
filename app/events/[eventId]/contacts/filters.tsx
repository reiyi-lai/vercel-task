"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";

// The Contacts filters, kept in the URL: ?ae= (an AE's accounts, or none: those with no AE, which BDRs work), ?engagement= (none or engaged), ?qualified=1.
const select = "h-8 rounded-lg bg-background-100 px-2.5 text-label-13 shadow-border";

export default function Filters({ aes }: { aes: { id: string; name: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const href = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    return `${path}${next.size ? `?${next}` : ""}`;
  };
  const go = (name: string, value: string) => router.replace(href(name, value), { scroll: false });
  const qualified = params.get("qualified") === "1";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="AE" className={select} value={params.get("ae") ?? ""} onChange={(e) => go("ae", e.target.value)}>
        <option value="">All AEs</option>
        {aes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        <option value="none">No AE (BDR accounts)</option>
      </select>
      <select aria-label="Prior engagement" className={select} value={params.get("engagement") ?? ""} onChange={(e) => go("engagement", e.target.value)}>
        <option value="">All Contacts</option>
        <option value="none">Cold Contacts Only</option>
        <option value="engaged">Warm Contacts Only</option>
      </select>
      <Button variant={qualified ? "secondary" : "primary"} onClick={() => go("qualified", qualified ? "" : "1")}>
        {qualified ? "Show All" : "Show Qualified Only"}
      </Button>
    </div>
  );
}
