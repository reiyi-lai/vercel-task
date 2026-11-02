"use server";

import type { EventBrief } from "@/lib/data";
import { ok, write } from "@/lib/write";

export async function saveBrief(brief: EventBrief) {
  return write(async (db) => ok(await db.from("event_briefs").upsert(brief)));
}
