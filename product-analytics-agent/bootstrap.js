// bootstrap-data.js
// Run once to seed the Google Sheets database with:
//   - Airtable: releases Jan 20, Feb 17, Mar 16, 2026
//   - Jira:     April 27, 2026 release items
// Usage: node bootstrap-data.js

import { setupSchema, batchUpsert, uuid } from './db.js'

const NOW = new Date().toISOString()

// ─── Releases ─────────────────────────────────────────────────────────────────

const releases = [
  { release_id: 'rel-2026-01-20', release_date: '2026-01-20', release_label: 'January 20, 2026',  source: 'airtable', created_at: NOW, updated_at: NOW },
  { release_id: 'rel-2026-02-17', release_date: '2026-02-17', release_label: 'February 17, 2026', source: 'airtable', created_at: NOW, updated_at: NOW },
  { release_id: 'rel-2026-03-16', release_date: '2026-03-16', release_label: 'March 16, 2026',    source: 'airtable', created_at: NOW, updated_at: NOW },
  { release_id: 'rel-2026-04-27', release_date: '2026-04-27', release_label: 'April 27, 2026',    source: 'jira',     created_at: NOW, updated_at: NOW },
]

// ─── Product areas ────────────────────────────────────────────────────────────

const rawAreas = [
  'Agents Core', 'Architecture', 'Core Listings', 'Core Social',
  'Data Management', 'FinServ', 'Local Adoption', 'Pages',
  'Reporting', 'Reputation', 'Search Agent', 'Social Agent', 'Voice of Customer'
]

const product_areas = rawAreas.map(name => ({
  area_id:    `area-${name.toLowerCase().replace(/\s+/g, '-')}`,
  area_name:  name,
  created_at: NOW,
}))

const areaId = name => `area-${name.toLowerCase().replace(/\s+/g, '-')}`

// ─── Release items — Airtable (Jan 20 – Mar 16) ───────────────────────────────

const airtable_items = [
  // January 20, 2026
  { jira_key: 'LA-26',       summary: 'LA-26 [Core] Support Locking Content in Community Calendar',         release_id: 'rel-2026-01-20', area_id: areaId('Local Adoption'), issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'REV-114',     summary: 'Review Networks: Uber Eats',                                          release_id: 'rel-2026-01-20', area_id: areaId('Reputation'),     issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SO-73680',    summary: '[CPL-5] [Corporate] Profile Templates',                               release_id: 'rel-2026-01-20', area_id: areaId('FinServ'),        issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SO-73684',    summary: '[CPL-11] Shield Dashboard > Supervision tab',                         release_id: 'rel-2026-01-20', area_id: areaId('FinServ'),        issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'n/a-arch-fr', summary: '[Reputation Agent] French Translation',                               release_id: 'rel-2026-01-20', area_id: areaId('Architecture'),   issue_type: 'Task',    status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'n/a-soc-ag',  summary: 'SOCIAL AGENT',                                                       release_id: 'rel-2026-01-20', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SOCIAL-543',  summary: '[CORE] Campaign Insights Report',                                     release_id: 'rel-2026-01-20', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SO-51104',    summary: '[CORE] Canva Connect API (Continue)',                                  release_id: 'rel-2026-01-20', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SOCIAL-1398', summary: '[Core] Expand First Comment Capabilities in Calendar',                release_id: 'rel-2026-01-20', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  // February 17, 2026
  { jira_key: 'SOCIAL-570',  summary: '[Core] Expiration Dates for Libraries',                               release_id: 'rel-2026-02-17', area_id: areaId('Local Adoption'), issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SUR-281',     summary: '[SURVEYS][Moz] Enable SMS Surveys',                                   release_id: 'rel-2026-02-17', area_id: areaId('Reputation'),     issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'REP-103',     summary: 'REP-101 & REP-103 Ability to Share Report via Email in XLS and PDF', release_id: 'rel-2026-02-17', area_id: areaId('Reporting'),      issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'CPL-59',      summary: '[CPL-59] Additional LinkedIn Profile Metrics GTM',                    release_id: 'rel-2026-02-17', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  // March 16, 2026
  { jira_key: 'REP-290',     summary: 'REP-290 Ability to customize tables with metadata before exporting',  release_id: 'rel-2026-03-16', area_id: areaId('Reporting'),      issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SO-76249',    summary: '[AGENT] Match Video from Source Library (18 days)',                   release_id: 'rel-2026-03-16', area_id: areaId('Social Agent'),   issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'DIS-502',     summary: 'DIS-502 Data Management Standard Data Group (Locations) Feature Release', release_id: 'rel-2026-03-16', area_id: areaId('Data Management'), issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'LIS-1202',    summary: '[Search] LIS-1202 Bulk Image Upload Capability to Search Agent',     release_id: 'rel-2026-03-16', area_id: areaId('Search Agent'),   issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SO-76108',    summary: '[CORE] First Comment In Libraries',                                   release_id: 'rel-2026-03-16', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SO-64432',    summary: '[CORE] LinkedIn Tagging',                                             release_id: 'rel-2026-03-16', area_id: areaId('Core Social'),    issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
  { jira_key: 'SMARTBOT-130-mar', summary: '[Chat] Express - UI Change',                                    release_id: 'rel-2026-03-16', area_id: areaId('Reputation'),     issue_type: 'Feature', status: 'Released', status_category: 'done', source: 'airtable' },
]

// ─── Release items — Jira (April 27, 2026) ────────────────────────────────────

const jira_april27_items = [
  { jira_key: 'SOCIAL-233',    summary: '[AGENT] Group Source Libraries (moved from Q4)',               release_id: 'rel-2026-04-27', area_id: areaId('Social Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-74015',      summary: 'LLP-677 Bulk Edit V3 for custom multiple fields',              release_id: 'rel-2026-04-27', area_id: areaId('Pages'),         issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-76277',      summary: '[AGENT] Support Video/Additional Network: TikTok',             release_id: 'rel-2026-04-27', area_id: areaId('Social Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SOCIAL-577',    summary: '[AGENT] Bulk Delete Recommendations (8 days)',                 release_id: 'rel-2026-04-27', area_id: areaId('Social Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-76968',      summary: '[AGENT] Increase max number of image uploads (7 days)',        release_id: 'rel-2026-04-27', area_id: areaId('Social Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-76987',      summary: '[AGENT] Holidays Enhancement (11)',                            release_id: 'rel-2026-04-27', area_id: areaId('Social Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-73677',      summary: 'CPL-3 LinkedIn Profile access from the Tasks dashboard',       release_id: 'rel-2026-04-27', area_id: areaId('FinServ'),       issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SMARTBOT-130',  summary: '[Chat] Express Commitments Part 1',                           release_id: 'rel-2026-04-27', area_id: areaId('Reputation'),    issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-73690',      summary: '[CPL-78] Customize Shield policies for incoming/outgoing reviews', release_id: 'rel-2026-04-27', area_id: areaId('FinServ'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-73686',      summary: '[CPL-74] Image Compliance Component - UX Enhancements',       release_id: 'rel-2026-04-27', area_id: areaId('FinServ'),       issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'LIS-1215',      summary: '[Search] LIS-1215 Google Products (Floor Plans & Pricing)',   release_id: 'rel-2026-04-27', area_id: areaId('Search Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'LIS-1164',      summary: '[Search] LIS-1164 Selective Network Publishing - Part 1',     release_id: 'rel-2026-04-27', area_id: areaId('Search Agent'),  issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-72719',      summary: 'Engagements Skill GA Readiness',                              release_id: 'rel-2026-04-27', area_id: areaId('Agents Core'),   issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
  { jira_key: 'SO-72770',      summary: '[Agents] Local Enablement - New Directives Screen',           release_id: 'rel-2026-04-27', area_id: areaId('Agents Core'),   issue_type: 'Feature', status: 'Live', status_category: 'done', source: 'jira' },
]

const all_items = [...airtable_items, ...jira_april27_items].map(item => ({
  item_id:          uuid(),
  release_id:       item.release_id,
  area_id:          item.area_id,
  jira_key:         item.jira_key,
  summary:          item.summary,
  issue_type:       item.issue_type || 'Feature',
  status:           item.status || 'Released',
  status_category:  item.status_category || 'done',
  priority:         null,
  assignee:         null,
  reporter:         null,
  created_date:     null,
  resolved_date:    null,
  components:       null,
  labels:           null,
  source:           item.source,
  pipeline_run_at:  NOW,
}))

// ─── Seed ─────────────────────────────────────────────────────────────────────

console.log('Setting up schema...')
await setupSchema()

console.log(`\nSeeding ${releases.length} releases...`)
const r = await batchUpsert('releases', 'release_id', releases)
console.log(`  inserted: ${r.inserted}, updated: ${r.updated}`)

console.log(`\nSeeding ${product_areas.length} product areas...`)
const a = await batchUpsert('product_areas', 'area_id', product_areas)
console.log(`  inserted: ${a.inserted}, updated: ${a.updated}`)

console.log(`\nSeeding ${all_items.length} release items...`)
const i = await batchUpsert('jira_release_items', 'jira_key', all_items)
console.log(`  inserted: ${i.inserted}, updated: ${i.updated}`)

console.log(`\nDone. Open your sheet:`)
console.log(`https://docs.google.com/spreadsheets/d/${process.env.SHEETS_DB_ID || '19ngFwYrm7p7MkWvXD3bH_IFDMu31p7iCDo8Aj6o5hTM'}`)