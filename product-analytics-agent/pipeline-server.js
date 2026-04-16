import { spawn } from 'child_process'
import { createServer } from 'http'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3001
const PROJECT_DIR = process.cwd()
const OUTPUT_DIR = join(__dirname, 'output')

// Ensure output fallback dir exists
if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

let pipelineProcess = null
let lastRunResult = null
let isRunning = false

// ─── Run the pipeline via Claude Code ────────────────────────────────────────

function buildPrompt(releaseDate = null) {
  const target = releaseDate
    ? `Run the product analytics pipeline for ${releaseDate}`
    : 'Run the product analytics pipeline for all recent releases'

  return target
}

function runPipeline(releaseDate = null) {
  if (isRunning) {
    log('Pipeline already running, skipping')
    return
  }

  isRunning = true
  const startedAt = new Date().toISOString()
  log(`Pipeline starting${releaseDate ? ` for ${releaseDate}` : ' (all releases)'}`)

  const prompt = buildPrompt(releaseDate)

  pipelineProcess = spawn('claude', [
    '--print',
    '--output-format', 'stream-json',
    '--agent', 'product-analytics-pipeline',
    prompt
  ], {
    cwd: PROJECT_DIR,
    env: { ...process.env }
  })

  let output = []
  let errors = []
  let buffer = ''

  pipelineProcess.stdout.on('data', chunk => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop()
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line)
        if (event.type === 'assistant' && event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text') {
              log('[claude]', block.text.slice(0, 200))
              output.push(block.text)
            }
          }
        }
      } catch {
        if (line.trim()) log('[raw]', line.slice(0, 200))
      }
    }
  })

  pipelineProcess.stderr.on('data', chunk => {
    const msg = chunk.toString().trim()
    if (msg) {
      errors.push(msg)
      log('[error]', msg)
    }
  })

  pipelineProcess.on('close', code => {
    const completedAt = new Date().toISOString()
    isRunning = false
    pipelineProcess = null

    lastRunResult = {
      startedAt,
      completedAt,
      status: code === 0 ? 'completed' : 'failed',
      exitCode: code,
      errors: errors.length ? errors : null,
      outputLines: output.length
    }

    log(`Pipeline ${lastRunResult.status} (exit ${code})`)

    // Always write a local JSON run log as fallback
    const runFile = join(OUTPUT_DIR, `run-${startedAt.replace(/[:.]/g, '-')}.json`)
    writeFileSync(runFile, JSON.stringify({ ...lastRunResult, output }, null, 2))
    log(`Run log saved to ${runFile}`)
  })
}

// ─── Nightly scheduler ────────────────────────────────────────────────────────

function scheduleNightlyRun() {
  const now = new Date()
  // Target: 2:00 AM local time
  const next = new Date(now)
  next.setHours(2, 0, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)

  const msUntilNext = next - now
  const hoursUntil = (msUntilNext / 1000 / 60 / 60).toFixed(1)
  log(`Next nightly run scheduled in ${hoursUntil}h (${next.toLocaleString()})`)

  setTimeout(() => {
    runPipeline()
    // Re-schedule for the following night
    scheduleNightlyRun()
  }, msUntilNext)
}

// ─── HTTP server for manual triggers and status ───────────────────────────────

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ ok: true }))
    return
  }

  // Status endpoint
  if (url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      isRunning,
      lastRun: lastRunResult
    }))
    return
  }

  // Manual trigger: POST /run or POST /run?release=April+27,+2026
  if (url.pathname === '/run' && req.method === 'POST') {
    const releaseDate = url.searchParams.get('release') || null

    if (isRunning) {
      res.writeHead(409, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Pipeline already running' }))
      return
    }

    runPipeline(releaseDate)
    res.writeHead(202, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      ok: true,
      message: `Pipeline started${releaseDate ? ` for ${releaseDate}` : ''}`,
      checkStatus: '/status'
    }))
    return
  }

  // Stop running pipeline
  if (url.pathname === '/stop' && req.method === 'POST') {
    if (pipelineProcess) {
      pipelineProcess.kill('SIGTERM')
      isRunning = false
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: 'Pipeline stopped' }))
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, message: 'No pipeline running' }))
    }
    return
  }

  res.writeHead(404)
  res.end('Not found')
})

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(...args) {
  const ts = new Date().toISOString()
  console.log(`[${ts}]`, ...args)
}

// ─── Start ────────────────────────────────────────────────────────────────────

server.listen(PORT, '127.0.0.1', () => {
  log(`Product Analytics Pipeline server running on http://127.0.0.1:${PORT}`)
  log(`Endpoints:`)
  log(`  GET  /status          -- check run status`)
  log(`  POST /run             -- trigger full pipeline`)
  log(`  POST /run?release=... -- trigger for specific release date`)
  log(`  POST /stop            -- stop running pipeline`)

  scheduleNightlyRun()
})
