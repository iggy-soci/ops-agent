# Product Analytics Pipeline Agent

This agent runs a data pipeline that pulls product analytics from Pendo,
normalizes it by release and product area, and writes it to Google Sheets.

## Purpose

Build and maintain a normalized analytics database so the product team can
answer questions about feature adoption and engagement without opening Pendo.

## How to invoke

Start Claude Code in this directory and say:
"Run the Pendo pipeline for April 27, 2026"

Or for all recent releases:
"Run the Pendo pipeline"

## MCP dependencies

- pendo — for adoption and engagement data
- atlassian (meetsoci.atlassian.net) — for release and product area context

## Environment variables required

    APPS_SCRIPT_URL=<deployed web app URL>
    SHEETS_DB_ID=19ngFwYrm7p7MkWvXD3bH_IFDMu31p7iCDo8Aj6o5hTM

## Pipeline steps

### Step 1 — Load releases and product areas from Google Sheets
Read the `releases` and `product_areas` tabs via the Apps Script Web App.
These are already seeded by bootstrap-data.js.

### Step 2 — For each release + product area combination, query Pendo
For each product area in each release, query Pendo for the 30-day window
ending on the release date (period_start = release_date - 30 days,
period_end = release_date).

Use the Pendo MCP to retrieve:
- Total visitor count for the period
- Active visitor count (visitors with at least 1 event)
- New visitor count
- Total account count
- Active account count
- Total feature events for features tagged to this product area
- Total page views for pages tagged to this product area
- Average time on feature (minutes)

Calculate:
- adoption_rate = active_accounts / total_accounts (as decimal, e.g. 0.42)

Map product area names to Pendo features and pages by matching the area name
against Pendo feature group names or page group names. Use fuzzy/partial
matching — e.g. "Social Agent" should match Pendo features containing "Social"
or "Agent". If no Pendo data is found for an area, log a warning and write
NULLs for that row rather than skipping it.

### Step 3 — Write to Google Sheets
For each release + product area combination, upsert a row into the
`pendo_adoption` tab using the Apps Script Web App.

Upsert key: combination of release_id + area_id (use adoption_id as the
unique key, constructed as `pendo-<release_id>-<area_id>`).

Fields to write:
- adoption_id: `pendo-<release_id>-<area_id>`
- release_id
- area_id
- total_visitors
- active_visitors
- new_visitors
- total_accounts
- active_accounts
- feature_events
- page_views
- avg_time_on_feature
- adoption_rate
- period_start
- period_end
- pipeline_run_at: current timestamp

### Step 4 — Log the pipeline run
Write a row to the `pipeline_runs` tab with:
- run_id: new UUID
- started_at
- completed_at
- status: "completed" or "failed"
- releases_synced: number of releases processed
- items_synced: number of pendo_adoption rows written
- errors: any error messages as JSON array

## Behavior rules

- Never skip a product area even if Pendo returns no data — write NULLs
- Always upsert so reruns are safe and idempotent
- Log every step to stdout with timestamps
- On any error, log and continue — never stop mid-run
- This is read-only from Pendo — never write back to Pendo

## Product area → Pendo mapping guide

When searching Pendo, try these name patterns per area:

| Product Area   | Search terms in Pendo          |
|----------------|-------------------------------|
| Social Agent   | Social, Agent, Genius Social  |
| Search Agent   | Search, Genius Search         |
| Agents Core    | Agent, Genius, Engagements    |
| Core Social    | Social, Scheduler, Post       |
| Core Listings  | Listings, LIS                 |
| Reputation     | Reviews, Chat, Surveys        |
| Reporting      | Report, REP                   |
| Data Management| Data Management, DIS          |
| FinServ        | Compliance, Shield, CPL       |
| Local Adoption | Local, Community Calendar     |
| Pages          | Pages, LLP                    |
| Voice of Customer | VoC, Voice                 |
| Architecture   | (skip — backend, no Pendo data)|