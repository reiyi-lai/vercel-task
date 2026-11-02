# Overview

This interface helps Vercel's experiential marketing team fill executive seats (F1 suites, dinners, roundtables) through the warmest available invitation route. This project holds the Next.js app and its sample data.

The Accounts tab lists 18 real target accounts (Target_Account__c): six retailers (Nordstrom, Target, Best Buy, Lowe's, Ulta Beauty, Chewy), five financial-services firms (Visa, Capital One, American Express, Fidelity, U.S. Bank) and seven fast-growing companies with no industry tag (Databricks, CrowdStrike, Toast, Datadog, ServiceNow, Zscaler, Palo Alto Networks), checked against Vercel's public customer stories on November 1, 2026. Their executives are real leaders from Sumble; their CRM context is limited to public evidence (job posts naming Next.js), with no invented deals or usage. The fictional accounts stay in the CRM for the warm-path and seating demos.

Of the invitation candidates, 3 are likely real Vercel targets, with connectors from public research (October 30, 2026): Rajat Taneja (Visa), Jason Morris (Nordstrom) and Prem Natarajan (Capital One). Everyone else, and every Vercel AE, is fictional.

To confirm before an ask goes out: Aparna Sinha is still at Vercel (a Stanford bio speaks of her role in the past tense);
Schwab and MSCI's customer status (Vercel names PayPal and Stripe publicly; Walmart and Wayfair are known customers); Dennis Howard's reporting line to
Rajat; whether Jason reported to Suresh Kumar.

## Run the App

```bash
npm install
npm run dev        
npm run seed       # rebuild supabase/seed.sql from the CSVs
```

With `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`, the app reads Supabase.
Without them, it reads the CSVs in `data/` through the same mapping (`lib/csv.ts`), which also builds `supabase/seed.sql`.

## Sample data

```
data/
  salesforce/                          CRM system of record (Salesforce-shaped exports, 18-character IDs)
    User.csv                           Vercel users: AEs, BDR, Field CTO, VP Sales, marketing
    Account.csv                        Target and customer accounts (Type, ICP tier, vertical, horizontal themes)
    Contact.csv                        Executives and connectors (LinkedIn URL, intro program opt-in, employment status, mailing city and coordinates, email opt-out)
    Opportunity.csv                    Open, closed-won and closed-lost opportunities
    OpportunityContactRole.csv         Who played which role on each opportunity (e.g. Champion)
    Task.csv                           Emails logged by Outreach (direction: inbound / outbound)
    Event.csv                          Meetings logged by Gong
    Campaign.csv                       Events (F1 suites, dinners, roundtables, webinars)
    CampaignMember.csv                 Event rosters: status, invite status, seat
  teamlink/teamlink_connections.csv    Vercel employees' LinkedIn 1st-degree connections (manual capture)
  clay/                                The Clay table: work history + The Swarm warm paths per target, config, payloads
  vercel/vercel_teams.csv              Product/billing export: teams, active users, spend, key contact
  connector_info/                      Events, Slack confirmations, connector monthly introduction caps,
                                       warm contacts (real customer leaders, Vercel executives, board and investors)
                                       event briefs, sample signals for the fictional accounts
  sumble/                              Warm contacts' work histories from Sumble's People API (npm run sumble:warm)
  samples/candidates_import.csv        A CSV to try the Candidates page's import (headers differ on purpose; some rows are incomplete)
```

## Architecture

Diagram: [Seatbook Architecture](https://claude.ai/artifact/9ntsBG8HoMn6GnEpsimzPM).

| Layer | What it does here |
|---|---|
| **Next.js 16 on Vercel** | App Router Server Components with Cache Components (Partial Prerendering, `'use cache'`). Tabs and filters live in the URL. |
| **Supabase Postgres** | One table per source (`supabase/migrations`), seeded from `data/` by `scripts/seed.ts`; the app reads it with the public anon key under read-only row-level security. |
| **Salesforce** | System of record for accounts, contacts, opportunities, Outreach/Gong activity and event Campaigns. Production syncs it through the Salesforce API. |
| **Clay** | Enrichment only: a Vercel Function posts each target to the Clay table, and Clay posts work history and The Swarm warm paths back (`data/clay/clay_table_config.json`). |
| **Slack** | Where connectors and AEs confirm how well they know a target; answers override inferred strength. |

Clay does enrichment only. Routes, scoring, caps, drafts and approvals stay in Seatbook (`lib/rules.ts`, `lib/derive.ts`).

## Routes

| Route | Where the path comes from | Confirmed by |
|---|---|---|
| **AE · existing customer** | The target's own account is a customer: their AE invites directly, always first | Slack DM to that AE |
| **AE / deal team** | Contact owner, plus Salesforce activity with the target | Batched Slack DM to the AE |
| **Current attendee** | Confirmed campaign member at the same event, linked by a Swarm path | Event Slack channel (seating by default) |
| **Via existing customer** | Opted-in contact at a customer account, linked by a Swarm path | Slack DM to the customer's AE |
| **Vercel leadership** | Field CTO / VP Sales, via activity, Swarm overlap or LinkedIn | Slack DM to the executive |

**Strength:** 
Paths rank by strength, then AE → attendee → customer → leadership. 

Monthly intro caps: Connectors at their monthly intro cap are paused, not dropped.

## Open questions

- Are AE emails and meetings logged to Salesforce through Outreach and Gong?
- Is each F1 suite and event run as a Salesforce Campaign with member statuses?
