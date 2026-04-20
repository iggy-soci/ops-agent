# Product Analytics Agent

Nightly pipeline that pulls from Pendo, normalizes by release and product area,
and writes to Google Sheets. Powers the product analytics query agent for the
SOCi product team.

---

## Architecture

```
pipeline-server.js
  Nightly scheduler (2am) + manual HTTP trigger
  Spawns Claude Code in headless mode
        │
        ▼
Claude Code (product-analytics-pipeline agent)
  Step 1: Read releases + product areas from Google Sheets
  Step 2: Query Pendo for each release + product area
  Step 3: Write adoption metrics to Google Sheets
  Step 4: Log the pipeline run
        │
        ▼
Google Sheets: Product Analytics DB
  releases             -- one row per release date
  product_areas        -- Social, Listings, Reviews, etc.
  jira_release_items   -- one row per release item
  pendo_adoption       -- adoption metrics per area + release
  newrelic_performance -- performance signals (coming soon)
  pipeline_runs        -- audit log of every run
```

---

## Setup (one time)

**1. Clone and enter the folder**
```bash
git clone https://github.com/iggy-soci/ops-agent.git
cd ops-agent/product-analytics-agent
```

**2. Copy the env file and fill in your values**
```bash
cp env.example .env
```

Open `.env` and set:
- `APPS_SCRIPT_URL` — the Web App URL from your deployed Apps Script
- `SHEETS_DB_ID` — already set to the correct spreadsheet ID

**3. Deploy Code.gs as a Web App in the Google Sheet**

Open the spreadsheet, go to Extensions → Apps Script, paste `Code.gs`,
then Deploy → New deployment → Web app → Execute as Me →
Anyone in meetsoci.com → Deploy. Copy the URL into `APPS_SCRIPT_URL`.

**4. Seed the database**
```bash
node bootstrap-data.js
```

**5. Start the server**
```bash
export $(cat .env | xargs)
node pipeline-server.js
```

---

## Running the pipeline

**Trigger a run for a specific release:**
```bash
npm run run-release -- "April 27, 2026"
```

**Trigger a full run:**
```bash
npm run run-now
```

**Check status:**
```bash
npm run status
```

The server also runs automatically at 2:00 AM every night.

---

## Connected services

| Service | What it's used for |
|---|---|
| Pendo (MCP) | Feature adoption and engagement metrics |
| Atlassian (MCP) | Release and product area context |
| Google Sheets | Normalized analytics database |

---

## Requirements

- macOS or Linux
- Node.js 18+
- Claude Code + Claude Max subscription
- Pendo MCP connected in claude.ai
- Atlassian MCP connected in claude.ai