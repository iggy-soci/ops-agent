import { setupSchema } from './db.js'

console.log('Setting up Product Analytics DB schema...')
try {
  await setupSchema()
  console.log('Done. Check your spreadsheet for the 6 tabs.')
} catch (err) {
  console.error('Setup failed:', err.message)
  process.exit(1)
}