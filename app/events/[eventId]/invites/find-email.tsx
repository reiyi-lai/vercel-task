"use client";

import { Button } from "@/components/ui";
import { usePost } from "@/components/use-post";

// Reveals an executive's work email through Sumble, about 11 credits, charged only when one is found.
export default function FindEmail({ contactId }: { contactId: string }) {
  const { pending, error, post } = usePost();
  return (
    <div className="flex flex-col items-start gap-1">
      <Button disabled={pending} onClick={() => post(`/api/contacts/${contactId}/email`, {})}>{pending ? "Finding…" : "Find Email"}</Button>
      {error && <p className="text-label-12 text-red-900">{error}</p>}
    </div>
  );
}
