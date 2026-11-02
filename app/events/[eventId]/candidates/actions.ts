"use server";

import type { CandidateInput } from "@/lib/candidates";
import { loadSnapshot } from "@/lib/data";
import { findOverlaps } from "@/lib/overlap";
import { fetchExperience, type SumbleRole } from "@/lib/sumble";
import { ok, write } from "@/lib/write";

export async function importCandidates(campaignId: string, rows: CandidateInput[]) {
  return write(async (db) => ok(await db.from("candidates").insert(rows.map((r) => ({ ...r, campaign_id: campaignId })))));
}

// Looks up each candidate's work history in Sumble by LinkedIn URL; [] marks someone Sumble couldn't find.
export async function generateWorkHistory(ids: string[]) {
  return write(async (db) => {
    const rows = ok(await db.from("candidates").select("id, linkedin_url").in("id", ids).not("linkedin_url", "is", null)) as { id: string; linkedin_url: string }[];
    const people = await fetchExperience(rows.map((r) => r.linkedin_url)); // one result per input, in order
    for (const [i, r] of rows.entries()) {
      ok(await db.from("candidates").update({ sumble_person_id: people[i].person_id ?? null, experience: people[i].attributes?.experience ?? [] }).eq("id", r.id));
    }
  });
}

// The invitation plan: warm contacts whose work history overlaps the candidate's, each tagged with its route.
export async function generatePlan(ids: string[]) {
  return write(async (db) => {
    const { warm_contacts } = await loadSnapshot();
    const rows = ok(await db.from("candidates").select("id, experience").in("id", ids).not("experience", "is", null)) as { id: string; experience: SumbleRole[] }[];
    for (const r of rows) ok(await db.from("candidates").update({ warm_overlaps: findOverlaps(r.experience, warm_contacts) }).eq("id", r.id));
  });
}
