"use client";

import { useState, type ReactNode } from "react";
import { Chevron } from "@/components/ui";

// A row on the AE/BDR page that opens on a click anywhere to show its work right here: an account's executives (the same
// rows as the Contacts page, whose columns this row's match: summary over Event Fit, aside over Prior Engagement), or a
// candidate's outreach sequence with its drafts. aside (e.g. Find More Executives) shows once it's open, with the chevron
// after it.
export default function RowToggle({ name, summary, aside, children }: { name: ReactNode; summary: ReactNode; aside: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div
        onClick={() => setOpen(!open)}
        className="grid cursor-pointer items-center gap-3 px-5 py-4 md:grid-cols-[minmax(0,1fr)_22%_26%_12rem] md:gap-0"
      >
        {/* For the keyboard: Enter or Space clicks it, and the click reaches the row. */}
        <button type="button" aria-expanded={open} className="min-w-0 cursor-pointer text-left md:pr-4">
          {name}
        </button>
        <div className="md:px-4">{summary}</div>
        <div className="flex items-center gap-3 md:px-4">
          {/* Clicks on the button act on it, not the row. */}
          {open && aside && <div onClick={(e) => e.stopPropagation()} className="cursor-default">{aside}</div>}
          <Chevron open={open} className="text-gray-900" />
        </div>
      </div>
      {open && <div className="px-5 pb-2">{children}</div>}
    </li>
  );
}
