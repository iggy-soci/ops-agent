# Product Analytics Pipeline Agent

This agent runs a nightly data pipeline that pulls product analytics data from
Jira, Pendo, and New Relic, normalizes it by release and product area, and
writes it to Snowflake.

## Purpose

Build and maintain a normalized analytics database that the Product Analytics
Agent can query to answer questions about feature adoption, release performance,
and product area health -- without hitting live APIs on every question.

## How to invoke

Start Claude Code in this directory and say:
"Run the product analytics pipeline"

Or for a specific release:
"Run the product analytics pipeline for April 27, 2026"

## MCP dependencies

- atlassian (meetsoci.atlassian.net) -- for Jira release items
- pendo -- for adoption and engagement data

## Environment variables required

Set these in your shell before running:

    NEW_RELIC_API_KEY=<your key>
    NEW_RELIC_ACCOUNT_ID=<your account id>
    SNOWFLAKE_ACCOUNT=<account identifier, e.g. xy12345.us-east-1>
    SNOWFLAKE_USER=<username>
    SNOWFLAKE_PASSWORD=<password>
    SNOWFLAKE_DATABASE=PRODUCT_OPS_DB
    SNOWFLAKE_SCHEMA=PRODUCT_ANALYTICS
    SNOWFLAKE_WAREHOUSE=COMPUTE_WH

## Pipeline steps

### Step 1 -- Fetch releases from Jira
Query the SO project Launches board (board 3801) to get all release dates.
Releases are the date-based groups shown on that board (e.g. "April 27, 2026").
Use this JQL to find items for a given release date:

    project = SO AND "Product[Select List (single choice)]" is not EMPTY

Product area is stored in customfield_12645 (field name: "Product").
Group results by the board's sprint or date grouping field.

### Step 2 -- Upsert releases and product areas into Snowflake
For each release date found, upsert into the releases table.
For each distinct product area value, upsert into product_areas table.

### Step 3 -- Sync Jira release items
For each release, fetch all SO tickets where customfield_12645 is set.
Map each ticket to its release_id and area_id.
Upsert into jira_release_items.

Key fields to extract per ticket:
- key (jira_key)
- summary
- issuetype.name (issue_type)
- status.name + status.statusCategory.key
- priority.name
- assignee.displayName
- reporter.displayName
- created (created_date)
- resolutiondate (resolved_date)
- components[].name (array)
- labels[] (array)
- customfield_12645.value (product area)

### Step 4 -- Pull Pendo adoption data
For each product_area + release combination, query Pendo for the 30-day
window ending on the release date. Use the Pendo MCP to:
- Get visitor counts (total, active, new)
- Get account counts (total, active)
- Get feature event totals for features tagged to that product area
- Calculate adoption_rate = active_accounts / total_accounts

Map product area names to Pendo feature/page groups by name matching.
If no Pendo data is found for an area, log a warning and continue.

### Step 5 -- Pull New Relic performance data
For each product_area + release combination, query New Relic REST API for
the same 30-day window using NRQL via the GraphQL API:

Endpoint: https://api.newrelic.com/graphql
Auth header: Api-Key: $NEW_RELIC_API_KEY

NRQL query per product area:
    SELECT average(duration)*1000 as avg_ms,
           percentile(duration*1000, 95) as p95_ms,
           percentile(duration*1000, 99) as p99_ms,
           rate(count(*), 1 minute) as throughput,
           filter(count(*), WHERE error IS true) / count(*) * 100 as error_rate
    FROM Transaction
    WHERE appName LIKE '%<product_area>%'
    SINCE '<period_start>'
    UNTIL '<period_end>'

If no matching app is found for a product area, log and continue.

### Step 6 -- Write to Snowflake
Upsert all collected data into:
- pendo_adoption (unique on release_id + area_id)
- newrelic_performance (unique on release_id + area_id)

Log the run in pipeline_runs with counts and any errors.

## Behavior rules

- Never skip a release even if Pendo or New Relic data is missing -- write
  what you have and leave missing columns as NULL
- Always upsert so reruns are safe and idempotent
- Log every step to stdout with timestamps
- If Snowflake is unavailable, write output to ./output/<run_date>.json
  as a fallback so data is never lost
- Never modify source systems -- read-only pipeline
- On error in any single step, log and continue, report all errors at end

## Jira field reference

| What           | Jira field name   | API path                  |
|----------------|-------------------|---------------------------|
| Product area   | Product           | customfield_12645.value   |
| Issue type     | Issue Type        | issuetype.name            |
| Status         | Status            | status.name               |
| Status cat.    | (derived)         | status.statusCategory.key |
| Components     | Component/s       | components[].name         |
| Resolution dt. | Resolved          | resolutiondate            |
