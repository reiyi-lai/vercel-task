"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Avatar, Badge, Button, Section, Tags } from "@/components/ui";
import type { eventOverview } from "@/lib/derive";

type Overview = NonNullable<ReturnType<typeof eventOverview>>;
type Seat = Overview["seats"][number];
type Guest = Overview["unseated"][number];

const seatBadge = { Confirmed: "inverted", Pending: "amber", Open: "outline" } as const;

// The seat grid. Swap Seats lets the team drag a guest onto another seat (or click one, then the other) to swap them;
// an open seat lists accepted guests without a seat. Changes stay in the browser: the prototype has no write path to Salesforce.
export default function Seats({ initialSeats, initialUnseated }: { initialSeats: Seat[]; initialUnseated: Guest[] }) {
  const [seats, setSeats] = useState(initialSeats);
  const [unseated, setUnseated] = useState(initialUnseated);
  const [swapping, setSwapping] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  const swap = (from: number, to: number) => {
    const next = [...seats];
    [next[from], next[to]] = [{ ...seats[to], n: from + 1 }, { ...seats[from], n: to + 1 }];
    setSeats(next);
    setPicked(null);
  };
  // First click picks a guest, the second swaps them into the clicked seat (or drops the pick).
  const pick = (i: number) => {
    if (picked === null) setPicked(seats[i].status === "Open" ? null : i);
    else if (picked === i) setPicked(null);
    else swap(picked, i);
  };
  const seat = (guest: Guest) => {
    setSeats(seats.map((s, i) => (i === adding ? { ...guest, n: i + 1, status: "Confirmed" as const } : s)));
    setUnseated(unseated.filter((g) => g.id !== guest.id));
    dialog.current!.close();
  };

  return (
    <Section
      title="Seats"
      description={swapping ? "Drag a guest onto another seat, or click one guest and then another seat, to swap them." : undefined}
      aside={<Button variant={swapping ? "primary" : "secondary"} onClick={() => { setSwapping(!swapping); setPicked(null); }}>{swapping ? "Done" : "Swap Seats"}</Button>}
    >
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {seats.map((s, i) => (
          <div
            key={s.n}
            {...(swapping && {
              role: "button",
              tabIndex: 0,
              "aria-pressed": picked === i,
              draggable: s.status !== "Open",
              onClick: () => pick(i),
              onKeyDown: (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); } },
              onDragStart: () => setPicked(i),
              onDragOver: (e: DragEvent) => e.preventDefault(),
              onDrop: () => picked !== null && picked !== i && swap(picked, i),
            })}
            className={`min-w-0 space-y-3 p-4 ${s.status === "Open" ? "rounded-xl border border-dashed border-gray-alpha-500 bg-background-200" : "material-small"} ${swapping ? "cursor-grab" : ""} ${picked === i ? "ring-2 ring-blue-700" : ""}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-label-12 text-gray-900">Seat {s.n}</span>
              <Badge variant={seatBadge[s.status]}>{s.status}</Badge>
            </div>
            {s.status === "Open" ? (
              <button
                type="button"
                disabled={swapping}
                onClick={() => { setAdding(i); dialog.current!.showModal(); }}
                className="flex w-full items-center gap-3 rounded-lg text-left enabled:hover:text-gray-1000 disabled:pointer-events-none"
              >
                <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full border border-gray-alpha-500 text-gray-900">+</span>
                <span className="text-heading-16">Open Seat</span>
              </button>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} size="lg" tone={s.status === "Confirmed" ? "dark" : "blue"} />
                  <div className="min-w-0">
                    <p className="break-words text-heading-16">{s.name}</p>
                    <p className="text-copy-13 text-gray-900">{s.title}</p>
                    <p className="text-copy-13 text-gray-900">{s.company}</p>
                  </div>
                </div>
                <Tags vertical={s.vertical} horizontals={s.horizontals} />
              </>
            )}
          </div>
        ))}
      </div>

      <dialog
        ref={dialog}
        onClose={() => setAdding(null)}
        className="m-auto w-[min(440px,calc(100vw-32px))] material-medium p-6 text-gray-1000 backdrop:bg-background-200/80"
      >
        <h3 className="text-heading-20">Fill Seat {adding === null ? "" : adding + 1}</h3>
        {unseated.length ? (
          <>
            <p className="mt-1 text-copy-14 text-gray-900">Accepted, but not seated yet.</p>
            <ul className="mt-4 space-y-2">
              {unseated.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => seat(g)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left shadow-border hover:bg-gray-100">
                    <Avatar name={g.name} tone="dark" />
                    <span className="min-w-0">
                      <span className="block text-label-14 font-medium">{g.name}</span>
                      <span className="block text-copy-13 text-gray-900">{g.title} · {g.company}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-copy-14 text-gray-900">Everyone who’s accepted has a seat. Invite more candidates to fill this one.</p>
        )}
        <div className="mt-6 flex justify-end"><Button onClick={() => dialog.current!.close()}>Cancel</Button></div>
      </dialog>
    </Section>
  );
}
