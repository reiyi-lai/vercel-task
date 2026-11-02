# Getting the Right People in the Room

This platform, Seatbook, helps fill executive seats at Vercel events (an F1 suite, a breakfast, a dinner). It takes an event from "who should we invite?" to "who said yes?" in one place.

## Problems it solves

| Stage | The problem today | What Seatbook does |
|---|---|---|
| 1. Define Event | Event context usually lives within Marketing and in docs or across Slack. | Single **Event Brief** page identifies for all stakeholders i.e. AEs/BDRs: target personas, seniority, location criteria, ideal outreach sequence (i.e. AE- or BDR- lead, with specified follow-up days) etc. |
| 2. Pick Accounts | Hard to quickly identify which target accounts from Vercel's TAM suit this event. | **Accounts** filters Vercel's target accounts in Salesforce by event requirements and shows existing Vercel Pro usage. |
| 3. Find the Right Executives | The CRM may still lack the right execs, or has stale titles. | **Find Executives** searches Sumble for that account's target personas, defined in Event Brief. ––> **Result**: List of real executives with LinkedIn profile URL that user can select to add to CRM and Executives list for that account. |
| 4. Gather Account Context | Generic invites get ignored. | **Signals** show new leaders (and allow adding them directly to CRM), job posts and relevant AI initiatives to personalise the invite. |
| 5. Sequence Outreach | Follow-ups slip. Nobody knows who owns which step. | **Candidates** shows list of selected candidates for that event across all accounts, and allows assigning of AEs/BDRs. Outreach sequence shows each step with drafts and has live Slack integration via Slack webhook (currently configured to Rachel's personal Slack workspace `vercel-trial`). |
| 6. Track progress | No single view of how complete event preparation is. | **Overview** shows progress against the specified goals in Event Brief and a Kanban board tracking pipeline. |

## Sample Flow

Visa is a real target account. Its signals are cleared on purpose, so you can see them being generated.

1. **Brief.** Open the Las Vegas Grand Prix brief. Check the target verticals, personas, seniority, location and guest target. This event is **AE-led**, so no BDR is needed.
2. **Accounts.** Find the account row for Visa. Click **Open Plan**.
3. **Account plan: Signals.** Click either buttons. They can run at the same time, but will take a while till you can refresh.
   - Clicking **Refresh Sumble Signals** loads new leaders hired and recent job post summaries. You can 'Add to CRM' the executives you deem relevant.
   - Clicking **Research AI Initiatives** uses Claude to search the web for Visa's AI projects via three categories: Internal Software; Retail/Agentic Commerce; Financial Services.
4. **Account plan: Executives.**
   - Executives already in the CRM are checked against the brief, showing as **Qualified**, **Review** or **Excluded** with context.
   - Clicking **Find Executives** allows you to find more people (in the target personas for this event) within this account via Sumble's /people API endpoint. Click **Add to CRM** on any result to save into CRM and onto this account page.
   - Select **Add Candidate** on the people to indicate as candidates for this event.
5. **Candidates.**
   - The candidates you've selected across all accounts for this event appear here.
   - Clicking **Find Email** fetches a missing email for that candidate via Sumble if needed.
   - **Start Sequence** kickstarts the outreach sequence, which involves a message to the respective AE/BDR via Slack.
6. **Per Candidate Invitation** (click **Invitation Plan →**).
   - Outreach Sequence shows entire timeline with steps and draft each. You can edit, open in Gmail, or copy it.
   - The ideal outcome is to sync this with Outreach's API and generate an Outreach sequence per event that syncs with the respective AE/BDR's inbox.
   - Temporary setup: **Mark Sent** once it goes out. Candidate outcome can be updated via **Replied, Accepted or Declined**.
7. **Overview.** View overview of invitation pipeline with shortlisted, invited and accepted counts against the targets. The pipeline board shows each candidate's stage and owner.

## External API Integrations

| Button | Service | What it does | Endpoint / Webhook URL |
|---|---|---|---|
| Refresh Sumble Signals | Sumble | Leadership changes and hiring from job posts. | `api.sumble.com/v9/organizations`, `/v9/people`, `/v9/jobs` |
| Research AI Initiatives | Claude with web search | Up to 10 searches. Keeps one initiative per theme. | `api.anthropic.com/v1/messages` |
| Find Executives | Sumble | People matching the brief's personas (about 100 credits). | `api.sumble.com/v9/organizations`, `/v9/people` |
| Add to CRM | Sumble | The person's current title and location (about 4 credits). | `api.sumble.com/v9/people` |
| Find Email | Sumble | Reveals a work email (10 credits). | `api.sumble.com/v9/people` |
| Start Sequence, Mark Sent, outcomes | Slack | Posts a card or alert to the team channel. | Incoming webhook: `hooks.slack.com/services/…` (set as `SLACK_WEBHOOK_URL`)<br>Seatbook posts a message to the webhook, which drops it into the channel. Clicking **Mark Sent** in Slack calls back to Seatbook at `/api/slack/interactions`. |
| Send Reminders, plus a daily schedule | Slack | Reminds senders of steps due or overdue, at 9am and 4pm Pacific. | API route: `/api/outreach/reminders`, then the Slack webhook<br>Vercel Cron calls the reminders route twice a day. It finds steps due or overdue and posts a card for each to the webhook. |

All Sumble calls are `POST`s with the API key. 

**Slack:** alerts post to `#<event-invitations>`, the channel the Slack webhook was set up for. Slack message has configured buttons **Mark Sent**, **Edit in Seatbook**, and **Open in Gmail**. In production, AE or BDR would be tagged in the message to that channel instead.

