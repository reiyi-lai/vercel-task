"use server";

import { ok, write } from "@/lib/write";

// A quick database write, so a Server Action is fine here; the slow Sumble and web-research work runs in
// app/api/accounts so several can run at once.
export async function setSelected(campaignId: string, contactId: string, selected: boolean) {
  return write(async (db) =>
    ok(
      selected
        ? await db.from("invitation_selections").upsert({ campaign_id: campaignId, contact_id: contactId })
        : await db.from("invitation_selections").delete().eq("campaign_id", campaignId).eq("contact_id", contactId)
    )
  );
}
