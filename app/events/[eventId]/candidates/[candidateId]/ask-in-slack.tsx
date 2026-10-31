"use client";

import { useRef, useState } from "react";
import { Button, Modal } from "@/components/ui";
import { DraftPanel, type Draft } from "./drafts";

// Ask in Slack opens that connector's drafts: the ask itself, then the blurb they forward.
export default function AskInSlack({ name, drafts, primary }: { name: string; drafts: Draft[]; primary: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState(0);
  const close = () => dialog.current!.close();
  return (
    <>
      <Button variant={primary ? "primary" : "secondary"} onClick={() => { setActive(0); dialog.current!.showModal(); }}>Ask in Slack</Button>
      <Modal ref={dialog} title={`Ask ${name} in Slack`}>
        <div className="mt-4">
          <DraftPanel draft={drafts[active]} tabs={drafts.map((d, i) => ({ label: d.tab, active: i === active, onClick: () => setActive(i) }))}>
            <Button variant="primary" className="flex-1" onClick={close}>{drafts[active].approve}</Button>
            <Button onClick={close}>Cancel</Button>
          </DraftPanel>
        </div>
      </Modal>
    </>
  );
}
