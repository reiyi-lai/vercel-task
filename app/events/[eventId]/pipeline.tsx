import Link from "next/link";
import { Avatar, Section, Status, Tags } from "@/components/ui";
import type { eventOverview } from "@/lib/derive";

type Columns = NonNullable<ReturnType<typeof eventOverview>>["pipeline"];

export default function Pipeline({ columns, bdrLed }: { columns: Columns; bdrLed: boolean }) {
  return (
    <Section title="Invitation Pipeline">
      <div className="-mx-4 -my-1 overflow-x-auto px-4 py-1 sm:-mx-1 sm:px-1">
        {/* Columns sized so four fit in the 1152px page with a sliver of the fifth showing; the board scrolls sideways. */}
        <div className="grid auto-cols-[262px] grid-flow-col items-start gap-3">
          {columns.map(({ title, dot, cards }) => (
            <div key={title} className="min-w-0 rounded-xl bg-gray-300 p-2">
              <div className="flex items-center justify-between px-2 pb-3 pt-1">
                <h3 className="text-label-13 font-medium"><Status color={dot}>{title}</Status></h3>
                <span className="flex size-6 items-center justify-center rounded-full bg-gray-1000 text-label-12 font-medium text-background-100">{cards.length}</span>
              </div>
              <div className="space-y-2">
                {cards.length === 0 && <p className="rounded-xl border border-dashed border-gray-alpha-500 p-3 text-label-12 text-gray-900">No one here yet.</p>}
                {cards.map((c) => (
                  <div key={c.id} className="space-y-2.5 rounded-xl bg-background-100 p-3 shadow-border">
                    <div>
                      <p className="break-words text-label-14 font-medium">{c.name}</p>
                      <p className="text-copy-13 text-gray-900">{c.title} · {c.company}</p>
                    </div>
                    <Tags vertical={c.vertical} horizontals={c.horizontals} />
                    <p className="text-label-12 text-gray-900">{c.detail}</p>
                    <div className="flex items-center gap-1.5 border-t border-gray-alpha-400 pt-2.5 text-label-12">
                      {c.owner ? (
                        <>
                          <Avatar name={c.owner} size="sm" />
                          <span className="shrink-0 whitespace-nowrap">{c.owner}</span>
                        </>
                      ) : (
                        <span className="shrink-0 whitespace-nowrap text-gray-900">{bdrLed ? "BDR" : "AE"} to be assigned</span>
                      )}
                      <Link href={c.href} className="-my-1 ml-auto shrink-0 whitespace-nowrap py-1 font-medium text-blue-900 hover:underline">Open Plan →</Link>
                    </div>
                  </div>
                  ))}
                </div>
              </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
