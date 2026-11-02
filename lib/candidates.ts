import type { Candidate } from "./data";

// The fields a candidate CSV maps onto. Required ones are flagged when empty; LinkedIn is the key Sumble looks people up by.
export const CANDIDATE_FIELDS = [
  { key: "first_name", label: "First Name", required: true, aliases: ["first", "firstname", "given name"] },
  { key: "last_name", label: "Last Name", required: true, aliases: ["last", "lastname", "surname", "family name"] },
  { key: "title", label: "Title", required: true, aliases: ["job title", "position", "role"] },
  { key: "company", label: "Company", required: true, aliases: ["account", "account name", "organization", "employer"] },
  { key: "linkedin_url", label: "LinkedIn URL", required: true, aliases: ["linkedin", "linkedin profile", "linkedin url c"] },
  { key: "email", label: "Email", required: false, aliases: ["work email", "email address"] },
] as const;

export type FieldKey = (typeof CANDIDATE_FIELDS)[number]["key"];
export type CandidateInput = Pick<Candidate, FieldKey>;
export type Mapping = Record<FieldKey, string>; // field → CSV header, "" when not in the file

const norm = (s: string) => s.toLowerCase().replace(/[_\-]+/g, " ").trim();

// Guesses each field's column from the CSV headers: the field's own name or label, or a common alias.
export const guessMapping = (headers: string[]) =>
  Object.fromEntries(
    CANDIDATE_FIELDS.map((f) => [f.key, headers.find((h) => [norm(f.key), norm(f.label), ...f.aliases].includes(norm(h))) ?? ""])
  ) as Mapping;

// "linkedin.com/in/x/" → "https://www.linkedin.com/in/x", the form Sumble matches on.
const linkedin = (url: string) => `https://www.${url.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/+$/, "")}`;
const isProfile = (url: string | null) => !!url && /^https:\/\/www\.linkedin\.com\/in\/[^/]+$/.test(url);

export function toCandidate(row: Record<string, string>, mapping: Mapping): CandidateInput {
  const get = (k: FieldKey) => row[mapping[k]]?.trim() || null;
  const url = get("linkedin_url");
  return { first_name: get("first_name"), last_name: get("last_name"), title: get("title"), company: get("company"), linkedin_url: url && linkedin(url), email: get("email") };
}

// Labels of required fields that are empty, or (for LinkedIn) not a profile URL Sumble can look up.
export const missingFields = (c: CandidateInput) =>
  CANDIDATE_FIELDS.filter((f) => f.required && !(f.key === "linkedin_url" ? isProfile(c.linkedin_url) : c[f.key])).map((f) => f.label);
