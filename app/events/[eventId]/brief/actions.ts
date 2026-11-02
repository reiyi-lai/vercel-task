"use server";

import type { EventBrief } from "@/lib/data";
import { ok, write } from "@/lib/write";

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

// Saves the brief, plus the event's dates (the Salesforce Campaign's start and end dates; no end date for a one-day
// event) and capacity (its seats), which the brief edits but which live on the campaign and the event.
export async function saveBrief(brief: EventBrief, details: { date: string; endDate: string | null; seats: number | null }) {
  if (!isDate(details.date)) return "Enter a valid start date.";
  if (details.endDate !== null && (!isDate(details.endDate) || details.endDate < details.date)) return "The end date must be a valid date on or after the start date.";
  if (details.seats !== null && (!Number.isInteger(details.seats) || details.seats < 1)) return "Capacity must be a whole number of seats.";
  if (!Number.isInteger(brief.target_guests) || brief.target_guests < 1) return "Target confirmed guests must be a whole number.";
  return write(async (db) => {
    ok(await db.from("event_briefs").upsert(brief));
    ok(await db.from("campaigns").update({ start_date: details.date, end_date: details.endDate }).eq("id", brief.campaign_id));
    ok(await db.from("events").update({ seats: details.seats }).eq("campaign_id", brief.campaign_id));
  });
}
