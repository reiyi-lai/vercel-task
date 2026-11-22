import Link from "next/link";
import { Avatar, Section, Status, Tags } from "@/components/ui";
import type { eventOverview } from "@/lib/derive";

type Stages = NonNullable<ReturnType<typeof eventOverview>>["stages"];

// The event's invites as a board, a column per stage. A column's title opens that stage on Invites, where it's acted
// on; a card opens the candidate's invitation plan.
export default function Board({ stages, basePath, bdrLed }: { stages: Stages; basePath: string; bdrLed: boolean }) {
  return (
    <Section title="Invites">
      <div className="-mx-4 -my-1 overflow-x-auto px-4 py-1 sm:-mx-1 sm:px-1">
        {/* Columns sized so four fit in the 1152px page with a sliver of the fifth showing; the board scrolls sideways. */}
        <div className="grid auto-cols-[262px] grid-flow-col items-start gap-3">
          {stages.map((st) => (
            <div key={st.key} className="min-w-0 rounded-xl bg-gray-300 p-2">
              <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-3">
                <Link href={`${basePath}/invites?stage=${st.key}`} className="min-w-0 text-label-13 font-medium hover:underline">
                  <Status color={st.color}>{st.label}</Status>
                </Link>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-gray-1000 text-label-12 font-medium text-background-100">{st.count}</span>
              </div>
              <div className="space-y-2">
                {st.cards.length === 0 && <p className="rounded-xl border border-dashed border-gray-alpha-500 p-3 text-label-12 text-gray-900">No one here yet.</p>}
                {st.cards.map((c) => (
                  <div key={c.id} className={`space-y-2.5 rounded-xl bg-background-100 p-3 ${c.overdue ? "ring-[1.5px] ring-red-700" : "shadow-border"}`}>
                    <div>
                      <p className="break-words text-label-14 font-medium">{c.name}</p>
                      <p className="text-copy-13 text-gray-900">{c.title} · {c.company}</p>
                    </div>
                    <Tags vertical={c.vertical} horizontals={c.horizontals} />
                    {c.detail && <p className={`text-label-12 ${c.overdue ? "text-red-900" : "text-gray-900"}`}>{c.detail}</p>}
                    <div className="flex items-center gap-1.5 border-t border-gray-alpha-400 pt-2.5 text-label-12">
                      {c.owner ? (
                        <>
                          <Avatar name={c.owner} size="sm" />
                          <span className="shrink-0 whitespace-nowrap">{c.owner}</span>
                        </>
                      ) : (
                        <span className="shrink-0 whitespace-nowrap text-gray-900">{bdrLed ? "BDR" : "AE"} to be assigned</span>
                      )}
                      {/* Awaiting approval: straight to the tab where marketing approves; otherwise the candidate's plan. */}
                      <Link href={st.key === "approval" ? `${basePath}/invites?stage=approval` : `${basePath}/invites/${c.id}`} className="-my-1 ml-auto shrink-0 py-1 font-medium whitespace-nowrap text-blue-900 hover:underline">
                        {st.key === "approval" ? "Approve →" : "Open Plan →"}
                      </Link>
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
