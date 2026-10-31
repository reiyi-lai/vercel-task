import { Button, Section, TabLinks } from "@/components/ui";
import type { drafts } from "@/lib/derive";

type Draft = ReturnType<typeof drafts>[number];
export const draftKey = (d: Draft) => d.tab.toLowerCase().replace(/[^a-z]+/g, "-");

// One server-rendered view per draft; ParamSwitch picks the one in ?draft=.
export default function Drafts({ drafts, active, basePath }: { drafts: Draft[]; active: number; basePath: string }) {
  const draft = drafts[active];
  return (
    <Section title="Message Drafts">
      <div className="material-base overflow-hidden">
        <div className="overflow-x-auto border-b border-gray-alpha-400 px-5 pt-3">
          <TabLinks items={drafts.map((d, i) => ({ label: d.tab, href: i === 0 ? basePath : `${basePath}?draft=${draftKey(d)}`, active: i === active }))} />
        </div>
        <div className="p-5">
          <p className="mb-3 text-label-12 text-gray-900">{draft.meta}</p>
          <p className="whitespace-pre-line text-copy-14">{draft.body}</p>
        </div>
        <div className="flex gap-2 border-t border-gray-alpha-400 bg-background-200 px-5 py-3">
          <Button variant="primary" className="flex-1">{draft.approve}</Button>
          <Button>Edit…</Button>
        </div>
      </div>
    </Section>
  );
}
