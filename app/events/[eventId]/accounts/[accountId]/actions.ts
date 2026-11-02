"use server";

import { TABLES } from "@/lib/data";
import { ok, write } from "@/lib/write";

// A quick database write, so a Server Action is fine here; the slow Sumble and web-research work runs in
// app/api/accounts so several can run at once.
// Assigns an unowned account to an AE; its contacts follow, since the AE sends their AE steps.
export async function assignAe(accountId: string, userId: string | null) {
  return write(async (db) => {
    ok(await db.from(TABLES.accounts).update({ owner_id: userId }).eq("id", accountId));
    ok(await db.from(TABLES.contacts).update({ owner_id: userId }).eq("account_id", accountId));
  });
}

// The BDR who sends a candidate's BDR steps for this event; null unassigns.
export async function assignBdr(campaignId: string, contactId: string, userId: string | null) {
  return write(async (db) =>
    ok(await db.from(TABLES.candidates).update({ bdr_id: userId }).eq("campaign_id", campaignId).eq("contact_id", contactId))
  );
}

export async function setSelected(campaignId: string, contactId: string, selected: boolean) {
  if (!selected) return removeCandidates(campaignId, [contactId]);
  return write(async (db) => ok(await db.from(TABLES.candidates).upsert({ campaign_id: campaignId, contact_id: contactId })));
}

// Deselects candidates. Their outreach (start date, sends, drafts) goes with the row, so selecting them again starts fresh.
export async function removeCandidates(campaignId: string, contactIds: string[]) {
  return write(async (db) => ok(await db.from(TABLES.candidates).delete().eq("campaign_id", campaignId).in("contact_id", contactIds)));
}
