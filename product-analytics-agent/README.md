# Product Analytics Agent

Nightly pipeline that pulls from Jira, Pendo, and New Relic, normalizes by
release and product area, and writes to Snowflake. Powers the product analytics
query agent for the SOCi product team.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  pipeline-server.js                                         │
│                                                             │
│  Nightly scheduler (2am) + manual HTTP trigger              │
│  Spawns Claude Code in headless mode                        │
└─────────────────────────────────────────────────────────────┘
              │ claude --print --agent product-analytics-pipeline
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Claude Code (product-analytics-pipeline agent)             │
│                                                             │
│  Step 1: Jira (Atlassian MCP) -- releases + items           │
│  Step 2: Pendo (Pendo MCP)    -- adoption metrics           │
│  Step 3: New Relic (REST API) -- performance signals        │
│  Step 4: Snowflake            -- upsert normalized data     │
└─────────────────────────────────────────────────────────────┘
              │ writes
              ▼
┌─────────────────────────────────────────────────────────────┐
│  Snowflake: PRODUCT_OPS_DB.PRODUCT_ANALYTICS                │
│                                                             │
│  releases           -- one row per release date             │
│  product_areas      -- Social, Listings, Reviews, etc.      │
│  jira_release_items -- one row per Jira ticket              │
│  pendo_adoption     -- adoption metrics per area+release    │
│  newrelic_performance -- perf signals per area+release      │
│  pipeline_runs      -- audit log of every run               │
│  v_release_summary  -- convenience view joining all above   │
└─────────────────────────────────────────────────────────────┘
```

---

## Setup (one time)

**1. Clone and enter the repo**
```bash
git clone https://github.com/iggy-soci/product-analytics-agent.git
cd product-analytics-agent
```

**2. Copy the env file and fill in your credentials**
```bash
cp .env.example .env
```
Edit `.env` with your New Relic API key, New Relic account ID, and Snowflake credentials.

**3. Run the Snowflake schema**

Open Snowflake, open a worksheet, paste the contents of `schema.sql`, and run it.
Replace `PRODUCT_OPS_DB` with your actual database name if different.

**4. Set up Claude Code**

You need:
- Claude Code installed and authenticated
- Claude Max subscription
- Atlassian and Pendo MCPs connected in your claude.ai account

**5. Source your env and start the server**
```bash
export $(cat .env | xargs)
node pipeline-server.js
```

---

## Running the pipeline

**Manually trigger a full run:**
```bash
npm run run-now
```

**Trigger for a specific release:**
```bash
npm run run-release -- "April 27, 2026"
```

**Check status:**
```bash
npm run status
```

**Nightly:** The server automatically runs the pipeline at 2:00 AM every night.
No cron configuration needed.

---

## Snowflake query examples

```sql
-- Release summary across all product areas
SELECT * FROM PRODUCT_ANALYTICS.v_release_summary
WHERE release_date = '2026-04-27'
ORDER BY product_area;

-- Adoption trend for Social over last 3 releases
SELECT r.release_date, pa.adoption_rate, pa.active_accounts
FROM PRODUCT_ANALYTICS.pendo_adoption pa
JOIN PRODUCT_ANALYTICS.releases r ON r.release_id = pa.release_id
JOIN PRODUCT_ANALYTICS.product_areas a ON a.area_id = pa.area_id
WHERE a.area_name = 'Social'
ORDER BY r.release_date DESC
LIMIT 3;

-- Items by status for a given release
SELECT j.status, COUNT(*) as count
FROM PRODUCT_ANALYTICS.jira_release_items j
JOIN PRODUCT_ANALYTICS.releases r ON r.release_id = j.release_id
WHERE r.release_date = '2026-04-27'
GROUP BY j.status;
```

---

## Requirements (per machine)

- macOS or Linux
- Node.js 18+
- Claude Code + Claude Max
- Atlassian MCP connected in claude.ai
- Pendo MCP connected in claude.ai
- New Relic API key (create at one.newrelic.com/api-keys)
- Snowflake write access to PRODUCT_OPS_DB schema
