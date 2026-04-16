-- ============================================================
-- Product Analytics Agent — Snowflake Schema
-- Run this once in your Snowflake worksheet to set up the schema
-- Replace PRODUCT_OPS_DB with your actual database name
-- ============================================================

-- Create the schema (run once)
CREATE SCHEMA IF NOT EXISTS PRODUCT_OPS_DB.PRODUCT_ANALYTICS;

USE SCHEMA PRODUCT_OPS_DB.PRODUCT_ANALYTICS;

-- ─── Core dimension: releases ─────────────────────────────────────────────────
-- One row per release date pulled from the Jira Launches board
CREATE TABLE IF NOT EXISTS releases (
    release_id        VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid(),
    release_date      DATE           NOT NULL,
    release_label     VARCHAR(255),           -- e.g. "April 27, 2026"
    created_at        TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP(),
    updated_at        TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_releases PRIMARY KEY (release_id),
    CONSTRAINT uq_releases_date UNIQUE (release_date)
);

-- ─── Core dimension: product areas ───────────────────────────────────────────
-- Distinct values from customfield_12645 in Jira SO project
CREATE TABLE IF NOT EXISTS product_areas (
    area_id           VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid(),
    area_name         VARCHAR(255)   NOT NULL,  -- e.g. "Social", "Listings"
    created_at        TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_product_areas PRIMARY KEY (area_id),
    CONSTRAINT uq_product_areas_name UNIQUE (area_name)
);

-- ─── Jira: release items ──────────────────────────────────────────────────────
-- One row per Jira ticket on the Launches board
CREATE TABLE IF NOT EXISTS jira_release_items (
    item_id           VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid(),
    release_id        VARCHAR(36)    NOT NULL,
    area_id           VARCHAR(36)    NOT NULL,
    jira_key          VARCHAR(50)    NOT NULL,  -- e.g. "SO-76980"
    summary           VARCHAR(1000),
    issue_type        VARCHAR(100),             -- Feature, Bug, Task, etc.
    status            VARCHAR(100),             -- Live, Closed, In Progress, etc.
    status_category   VARCHAR(50),              -- done, in-progress, todo
    priority          VARCHAR(50),
    assignee          VARCHAR(255),
    reporter          VARCHAR(255),
    created_date      DATE,
    resolved_date     DATE,
    components        VARIANT,                  -- array of component names
    labels            VARIANT,                  -- array of labels
    pipeline_run_at   TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_jira_release_items PRIMARY KEY (item_id),
    CONSTRAINT uq_jira_key UNIQUE (jira_key),
    CONSTRAINT fk_jri_release FOREIGN KEY (release_id) REFERENCES releases(release_id),
    CONSTRAINT fk_jri_area    FOREIGN KEY (area_id)    REFERENCES product_areas(area_id)
);

-- ─── Pendo: feature adoption ──────────────────────────────────────────────────
-- One row per product area per release, populated from Pendo MCP
CREATE TABLE IF NOT EXISTS pendo_adoption (
    adoption_id           VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid(),
    release_id            VARCHAR(36)    NOT NULL,
    area_id               VARCHAR(36)    NOT NULL,
    -- Visitor metrics
    total_visitors        INTEGER,
    active_visitors       INTEGER,        -- visitors with at least 1 event in period
    new_visitors          INTEGER,
    -- Account metrics
    total_accounts        INTEGER,
    active_accounts       INTEGER,
    -- Feature usage
    feature_events        INTEGER,        -- total feature click events
    page_views            INTEGER,
    avg_time_on_feature   FLOAT,          -- minutes
    -- Adoption rate (active_accounts / total_accounts)
    adoption_rate         FLOAT,
    -- Period covered (release date -30d to release date)
    period_start          DATE,
    period_end            DATE,
    -- Raw Pendo response stored for auditability
    raw_payload           VARIANT,
    pipeline_run_at       TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_pendo_adoption PRIMARY KEY (adoption_id),
    CONSTRAINT uq_pendo_release_area UNIQUE (release_id, area_id),
    CONSTRAINT fk_pa_release FOREIGN KEY (release_id) REFERENCES releases(release_id),
    CONSTRAINT fk_pa_area    FOREIGN KEY (area_id)    REFERENCES product_areas(area_id)
);

-- ─── New Relic: performance signals ──────────────────────────────────────────
-- One row per product area per release, populated from New Relic API
CREATE TABLE IF NOT EXISTS newrelic_performance (
    perf_id               VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid(),
    release_id            VARCHAR(36)    NOT NULL,
    area_id               VARCHAR(36)    NOT NULL,
    -- Error metrics
    error_rate            FLOAT,          -- errors per minute
    error_count           INTEGER,
    -- Throughput
    throughput            FLOAT,          -- requests per minute
    -- Response time (ms)
    avg_response_time_ms  FLOAT,
    p95_response_time_ms  FLOAT,
    p99_response_time_ms  FLOAT,
    -- Apdex score (0-1)
    apdex_score           FLOAT,
    -- Availability
    uptime_pct            FLOAT,
    -- Period covered (aligned with Pendo period)
    period_start          DATE,
    period_end            DATE,
    -- Raw New Relic response
    raw_payload           VARIANT,
    pipeline_run_at       TIMESTAMP_NTZ  DEFAULT CURRENT_TIMESTAMP(),
    CONSTRAINT pk_newrelic_performance PRIMARY KEY (perf_id),
    CONSTRAINT uq_nr_release_area UNIQUE (release_id, area_id),
    CONSTRAINT fk_np_release FOREIGN KEY (release_id) REFERENCES releases(release_id),
    CONSTRAINT fk_np_area    FOREIGN KEY (area_id)    REFERENCES product_areas(area_id)
);

-- ─── Pipeline run log ─────────────────────────────────────────────────────────
-- Tracks every nightly run for debugging and auditing
CREATE TABLE IF NOT EXISTS pipeline_runs (
    run_id            VARCHAR(36)    NOT NULL DEFAULT gen_random_uuid(),
    started_at        TIMESTAMP_NTZ  NOT NULL,
    completed_at      TIMESTAMP_NTZ,
    status            VARCHAR(50),    -- running, completed, failed
    releases_synced   INTEGER,
    items_synced      INTEGER,
    errors            VARIANT,        -- array of error messages if any
    CONSTRAINT pk_pipeline_runs PRIMARY KEY (run_id)
);

-- ─── Convenience view: full release summary ───────────────────────────────────
CREATE OR REPLACE VIEW v_release_summary AS
SELECT
    r.release_date,
    r.release_label,
    pa.area_name                                          AS product_area,
    COUNT(DISTINCT j.jira_key)                            AS total_items,
    COUNT(DISTINCT CASE WHEN j.status_category = 'done'
                        THEN j.jira_key END)              AS completed_items,
    ROUND(COUNT(DISTINCT CASE WHEN j.status_category = 'done'
                              THEN j.jira_key END)
          / NULLIF(COUNT(DISTINCT j.jira_key), 0) * 100, 1) AS completion_pct,
    pendo.adoption_rate,
    pendo.active_accounts,
    pendo.feature_events,
    nr.error_rate,
    nr.avg_response_time_ms,
    nr.apdex_score
FROM releases r
JOIN jira_release_items j  ON j.release_id = r.release_id
JOIN product_areas pa      ON pa.area_id   = j.area_id
LEFT JOIN pendo_adoption pendo
    ON pendo.release_id = r.release_id
   AND pendo.area_id    = j.area_id
LEFT JOIN newrelic_performance nr
    ON nr.release_id = r.release_id
   AND nr.area_id    = j.area_id
GROUP BY
    r.release_date,
    r.release_label,
    pa.area_name,
    pendo.adoption_rate,
    pendo.active_accounts,
    pendo.feature_events,
    nr.error_rate,
    nr.avg_response_time_ms,
    nr.apdex_score
ORDER BY r.release_date DESC, pa.area_name;
