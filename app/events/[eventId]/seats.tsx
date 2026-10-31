"use client";

import { useRef, useState, type DragEvent, type KeyboardEvent } from "react";
import { Avatar, Badge, Button, Modal, Section, Tags } from "@/components/ui";
import type { eventOverview } from "@/lib/derive";

type Overview = NonNullable<ReturnType<typeof eventOverview>>;
type Seat = Overview["seats"][number];
type Guest = Omit<Extract<Seat, { name: string }>, "n">;

const seatBadge = { Confirmed: "inverted", Pending: "amber", Open: "outline" } as const;

// The seat grid. Edit Seats lets the team drag a guest onto another seat (or click one, then the other) to swap them,
// or remove a guest with ×; an open seat lists guests without a seat, including anyone removed. Changes stay in the browser: the prototype has no write path to Salesforce.
export default function Seats({ initialSeats, initialUnseated }: { initialSeats: Seat[]; initialUnseated: Guest[] }) {
  const [seats, setSeats] = useState(initialSeats);
  const [unseated, setUnseated] = useState(initialUnseated);
  const [editing, setEditing] = useState(false);
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
  const remove = (i: number) => {
    const { n, ...guest } = seats[i] as Extract<Seat, { name: string }>;
    setSeats(seats.map((s) => (s.n === n ? { n, status: "Open" as const } : s)));
    setUnseated([...unseated, guest]);
    setPicked(null);
  };
  const seat = (guest: Guest) => {
    setSeats(seats.map((s, i) => (i === adding ? { ...guest, n: i + 1 } : s)));
    setUnseated(unseated.filter((g) => g.id !== guest.id));
    dialog.current!.close();
  };

  return (
    <Section
      title="Seats"
      description={editing ? "Drag a guest onto another seat, or click one guest and then another seat, to swap them. × removes a guest from their seat." : undefined}
      aside={<Button variant={editing ? "primary" : "secondary"} onClick={() => { setEditing(!editing); setPicked(null); }}>{editing ? "Done" : "Edit Seats"}</Button>}
    >
      <div className="grid grid-cols-2 items-start gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {seats.map((s, i) => (
          <div
            key={s.n}
            {...(editing && {
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
            className={`relative min-w-0 space-y-3 p-4 ${s.status === "Open" ? "rounded-xl border border-dashed border-gray-alpha-500 bg-background-200" : "material-small"} ${editing ? "cursor-grab" : ""} ${picked === i ? "ring-2 ring-blue-700" : ""}`}
          >
            {editing && s.status !== "Open" && (
              <button
                type="button"
                aria-label={`Remove ${s.name} from Seat ${s.n}`}
                onClick={(e) => { e.stopPropagation(); remove(i); }}
                onKeyDown={(e) => e.stopPropagation()}
                className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full bg-background-100 text-gray-900 shadow-border hover:bg-gray-100 hover:text-gray-1000"
              >
                <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
              </button>
            )}
            <div className="flex items-center justify-between">
              <span className="text-label-12 text-gray-900">Seat {s.n}</span>
              <Badge variant={seatBadge[s.status]}>{s.status}</Badge>
            </div>
            {s.status === "Open" ? (
              <button
                type="button"
                disabled={editing}
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

      <Modal ref={dialog} onClose={() => setAdding(null)} title={`Fill Seat ${adding === null ? "" : adding + 1}`}>
        {unseated.length ? (
          <>
            <p className="mt-1 text-copy-14 text-gray-900">Not seated yet.</p>
            <ul className="mt-4 space-y-2">
              {unseated.map((g) => (
                <li key={g.id}>
                  <button type="button" onClick={() => seat(g)} className="flex w-full items-center gap-3 rounded-lg p-2 text-left shadow-border hover:bg-gray-100">
                    <Avatar name={g.name} tone={g.status === "Confirmed" ? "dark" : "blue"} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-label-14 font-medium">{g.name}</span>
                      <span className="block text-copy-13 text-gray-900">{g.title} · {g.company}</span>
                    </span>
                    {g.status === "Pending" && <Badge variant="amber">Pending</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-2 text-copy-14 text-gray-900">Everyone who’s accepted has a seat. Invite more candidates to fill this one.</p>
        )}
        <div className="mt-6 flex justify-end"><Button onClick={() => dialog.current!.close()}>Cancel</Button></div>
      </Modal>
    </Section>
  );
}
