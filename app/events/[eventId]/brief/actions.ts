"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { TABLES, loadSnapshot, type EventBrief } from "@/lib/data";
import { ok, write } from "@/lib/write";

type Details = { date: string; endDate: string | null; seats: number | null };

const isDate = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d));

const invalid = (brief: EventBrief, details: Details) =>
  !isDate(details.date) ? "Enter a valid start date."
  : details.endDate !== null && (!isDate(details.endDate) || details.endDate < details.date) ? "The end date must be a valid date on or after the start date."
  : details.seats !== null && (!Number.isInteger(details.seats) || details.seats < 1) ? "Capacity must be a whole number of seats."
  : brief.select_by !== null && (!isDate(brief.select_by) || brief.select_by > details.date) ? "The selection deadline must be a valid date on or before the start date."
  : !Number.isInteger(brief.target_guests) || brief.target_guests < 1 ? "Target confirmed guests must be a whole number."
  : null;

// Saves the brief, plus the event's dates (the Salesforce Campaign's start and end dates; no end date for a one-day
// event) and capacity (its seats), which the brief edits but which live on the campaign and the event.
export async function saveBrief(brief: EventBrief, details: Details) {
  const err = invalid(brief, details);
  if (err) return err;
  return write(async (db) => {
    ok(await db.from(TABLES.events).update({ ...brief, seats: details.seats }).eq("campaign_id", brief.campaign_id));
    ok(await db.from(TABLES.campaigns).update({ start_date: details.date, end_date: details.endDate }).eq("id", brief.campaign_id));
  });
}

// Creates an event from a filled-in brief: its Salesforce campaign (here a row in our copy; in production, created
// through the Salesforce API) and the event, then opens its Overview. The slug comes from the short name.
export async function createEvent(brief: EventBrief, details: Details, names: { name: string; shortName: string }) {
  const name = names.name.trim();
  const shortName = names.shortName.trim();
  const err = !name || !shortName ? "Enter the event’s name and short name." : invalid(brief, details);
  if (err) return err;
  const taken = new Set(["new", ...(await loadSnapshot()).events.map((e) => e.slug)]);
  const base = shortName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
  let slug = base;
  for (let i = 2; taken.has(slug); i++) slug = `${base}-${i}`;
  const id = `701${randomUUID().replaceAll("-", "").slice(0, 15).toUpperCase()}`; // Salesforce-style 18-character ID
  const error = await write(async (db) => {
    ok(await db.from(TABLES.campaigns).insert({ id, name, start_date: details.date, end_date: details.endDate, status: "Planned" }));
    ok(await db.from(TABLES.events).insert({ ...brief, campaign_id: id, slug, short_name: shortName, program: null, seats: details.seats, host_user_ids: [] }));
  });
  if (error) return error;
  redirect(`/events/${slug}`);
}
