/**
 * Service worker — runs the lookups, holds the results.
 *
 * MV3 kills this worker after ~30 seconds idle and a sheet of seeds takes
 * minutes, so nothing about a run lives in memory: every seed's result is
 * written to chrome.storage as it lands, and the panel reads from there. A
 * closed panel, a suspended worker and a reopened panel all see the same run.
 *
 * Google Autocomplete needs no tab, so the worker fetches it directly. Sources
 * that do need a tab (a planner behind a sign-in) will route through a content
 * script the way Proxy Poster does — `Source.needsTab` is the switch, and the
 * branch is marked below rather than pretended away.
 */

import { countryFor, type KeywordRow } from '../lib/keywords'
import { sourceFor } from '../lib/registry'
import type { SeedRow } from '../lib/sheet'

const RUN_KEY = 'kw:run'

export interface Run {
  id: string
  startedAt: number
  sourceId: string
  defaultCountry: string
  seeds: SeedRow[]
  /** Seeds finished, successfully or not. */
  done: number
  status: 'running' | 'done' | 'aborted' | 'error'
  rows: KeywordRow[]
  /** Per-seed notes — a handoff or a failure, so nothing disappears quietly. */
  notes: Array<{ seed: string; kind: string; detail: string }>
}

let abort: AbortController | null = null

async function save(run: Run): Promise<void> {
  await chrome.storage.local.set({ [RUN_KEY]: run })
  chrome.runtime.sendMessage({ channel: 'kw:run', run }).catch(() => {
    /* panel closed — it re-reads storage on mount */
  })
}

async function load(): Promise<Run | null> {
  const bag = await chrome.storage.local.get(RUN_KEY)
  return (bag[RUN_KEY] as Run | undefined) ?? null
}

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

async function start(seeds: SeedRow[], sourceId: string, defaultCountry: string): Promise<void> {
  const source = sourceFor(sourceId)
  if (!source) throw new Error(`"${sourceId}" is not a source this build will run`)

  abort?.abort()
  abort = new AbortController()
  const signal = abort.signal

  const run: Run = {
    id: `run_${Date.now().toString(36)}`,
    startedAt: Date.now(),
    sourceId,
    defaultCountry,
    seeds,
    done: 0,
    status: 'running',
    rows: [],
    notes: [],
  }
  await save(run)

  for (const seed of seeds) {
    if (signal.aborted) break

    const country = countryFor(seed.country ?? defaultCountry)
    if (!country) {
      run.notes.push({ seed: seed.keyword, kind: 'failed', detail: `unknown country "${seed.country}"` })
      run.done++
      await save(run)
      continue
    }

    try {
      // Tab-based sources are not wired yet; the only one shipped fetches
      // directly. Saying so beats a silent wrong path when one is added.
      if (source.needsTab) throw new Error(`${source.name} needs a tab, which this build does not drive yet`)

      const out = await source.lookup(seed.keyword, country, signal)
      if (out.kind === 'ok') {
        // Carry the sheet's own columns onto every result, so the export
        // pivots back to the tool it was researched for.
        run.rows.push(
          ...out.rows.map((r) => ({ ...r, tool: seed.tool, group: seed.group, batch: seed.batch })),
        )
      } else if (out.kind === 'handoff') {
        run.notes.push({ seed: seed.keyword, kind: out.reason, detail: out.note ?? out.url })
      } else if (out.kind === 'drift') {
        run.notes.push({ seed: seed.keyword, kind: 'drift', detail: `expected ${out.expected}` })
      } else {
        run.notes.push({ seed: seed.keyword, kind: 'failed', detail: out.reason })
      }
    } catch (e) {
      if (signal.aborted) break
      run.notes.push({ seed: seed.keyword, kind: 'failed', detail: String(e).slice(0, 160) })
    }

    run.done++
    await save(run)
  }

  run.status = signal.aborted ? 'aborted' : 'done'
  await save(run)
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  switch (msg?.channel) {
    case 'kw:start': {
      void (async () => {
        try {
          sendResponse({ ok: true })
          await start(msg.seeds as SeedRow[], String(msg.sourceId), String(msg.defaultCountry))
        } catch (e) {
          const run = await load()
          if (run) {
            run.status = 'error'
            run.notes.push({ seed: '—', kind: 'failed', detail: String(e).slice(0, 200) })
            await save(run)
          }
        }
      })()
      return true
    }

    case 'kw:abort': {
      abort?.abort()
      sendResponse({ ok: true })
      return false
    }

    case 'kw:get': {
      void load().then((run) => sendResponse({ run }))
      return true
    }

    case 'kw:clear': {
      void chrome.storage.local.remove(RUN_KEY).then(() => sendResponse({ ok: true }))
      return true
    }

    default:
      return false
  }
})
