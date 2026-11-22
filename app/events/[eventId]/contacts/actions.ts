"use server";

import { TABLES } from "@/lib/data";
import { ok, write } from "@/lib/write";

// Quick database writes, so Server Actions are fine here; the slow Sumble work runs in app/api/accounts so several
// can run at once.
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

// Adds executives as candidates for the event; any already added are left as they are.
export async function addCandidates(campaignId: string, contactIds: string[]) {
  return write(async (db) =>
    ok(await db.from(TABLES.candidates).upsert(contactIds.map((contact_id) => ({ campaign_id: campaignId, contact_id })), { ignoreDuplicates: true }))
  );
}

// Deselects candidates. Their outreach (start date, sends, drafts) goes with the row, so selecting them again starts fresh.
export async function removeCandidates(campaignId: string, contactIds: string[]) {
  return write(async (db) => ok(await db.from(TABLES.candidates).delete().eq("campaign_id", campaignId).in("contact_id", contactIds)));
}

// Removes one Find More Executives result. A later search can find them again.
export async function removeFound(campaignId: string, linkedinUrl: string) {
  return write(async (db) => ok(await db.from(TABLES.found_executives).delete().eq("campaign_id", campaignId).eq("linkedin_url", linkedinUrl)));
}
