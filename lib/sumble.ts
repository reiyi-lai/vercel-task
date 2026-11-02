// Sumble's API (docs.sumble.com/api), trimmed to what Seatbook reads: people (work history, recent leaders),
// organizations (resolving an account's domain) and job posts. People requests are async: a POST starts a job,
// then POSTing { request_id } polls it until it succeeds; credits are charged once, on success.
// Empty fields are omitted rather than null: a current role has no end_date.

export type SumbleEmployer = { organization_id?: number; name: string; slug?: string; linkedin_url?: string; sumble_url?: string };
export type SumbleRole = {
  title?: string; start_date?: string; end_date?: string; duration?: string; location?: string; description?: string; employer: SumbleEmployer;
};
export type SumblePerson = {
  input?: { linkedin_url: string };
  person_id?: number; // absent when the URL didn't match anyone
  sumble_url?: string;
  attributes?: {
    name?: string; job_title?: string; linkedin_url?: string; location?: string; email?: string;
    current_employer?: SumbleEmployer & { start_date?: string }; // start_date: when the current role began, so promotions count
    experience?: SumbleRole[];
  };
};
export type SumbleJob = { job_id: number; sumble_url: string; attributes: { title: string; posted_date: string } };

// LinkedIn profile URLs compared without the scheme, "www." or a trailing slash.
export const profileKey = (url: string) => url.toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/\/+$/, "");

export async function sumble(path: string, body: object) {
  const call = async (b: object) => {
    const res = await fetch(`https://api.sumble.com/v9/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.SUMBLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(b),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Sumble ${res.status}: ${JSON.stringify(json.detail)}`);
    return json;
  };
  let job = await call(body);
  while (job.status === "pending" || job.status === "running") {
    await new Promise((r) => setTimeout(r, 3000));
    job = await call({ request_id: job.request_id });
  }
  if (job.status && job.status !== "succeeded") throw new Error(`Sumble job ${job.request_id} ${job.status}`);
  return job;
}

// Work history for up to 200 people by LinkedIn URL: 3 credits per matched person, unmatched are free.
export async function fetchExperience(linkedinUrls: string[]): Promise<SumblePerson[]> {
  const job = await sumble("people", { people: linkedinUrls.map((linkedin_url) => ({ linkedin_url })), select: { attributes: ["name", "current_employer", "experience"] } });
  return job.people;
}
