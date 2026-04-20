// db.js — Google Sheets database via Apps Script Web App
// No service account, no Google Cloud billing, no googleapis package needed.

const WEB_APP_URL = process.env.APPS_SCRIPT_URL

if (!WEB_APP_URL) {
  console.error('ERROR: APPS_SCRIPT_URL is not set in your .env file')
  process.exit(1)
}

export function uuid() {
  return crypto.randomUUID()
}

export async function setupSchema() {
  const res = await fetch(`${WEB_APP_URL}?action=setup`)
  const data = await res.json()
  if (!data.ok) throw new Error('Schema setup failed: ' + JSON.stringify(data))
  return data
}

export async function readTable(tableName) {
  const res = await fetch(`${WEB_APP_URL}?action=read&table=${encodeURIComponent(tableName)}`)
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.rows
}

export async function findRow(tableName, keyCol, keyVal) {
  const rows = await readTable(tableName)
  return rows.find(r => r[keyCol] === String(keyVal)) || null
}

export async function upsert(tableName, uniqueKey, record) {
  return batchUpsert(tableName, uniqueKey, [record])
}

export async function batchUpsert(tableName, uniqueKey, records) {
  const res = await fetch(WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'upsert', table: tableName, uniqueKey, records })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return { inserted: data.inserted, updated: data.updated }
}

export async function queryWhere(tableName, filters) {
  const rows = await readTable(tableName)
  return rows.filter(row =>
    Object.entries(filters).every(([k, v]) => row[k] === String(v))
  )
}

export async function healthCheck() {
  const res = await fetch(`${WEB_APP_URL}?action=health`)
  return res.json()
}