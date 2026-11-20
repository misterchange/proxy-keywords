/**
 * Ahrefs free Keyword Generator — volume and KD, driven in a visible tab.
 *
 * https://ahrefs.com/keyword-generator/ takes a keyword and a country and
 * returns a table of ideas with search volume and keyword difficulty. That is
 * the number Google Autocomplete cannot give, which is why this source exists.
 *
 * HOW A LOOKUP RUNS
 * -----------------
 * The worker opens the page in a real, foreground tab with
 * `?country=<code>&input=<seed>` — the URL the page itself writes after a
 * search (checked 15 Oct 2026) — then injects `driveAhrefs` below, which:
 *
 *   1. makes sure the keyword box and the country picker say what we asked for
 *      (picking the country through the page's own search-and-click menu if the
 *      URL did not set it),
 *   2. presses "Find keywords",
 *   3. waits for a results table, and reads it.
 *
 * THE HUMAN CHECK
 * ---------------
 * Pressing "Find keywords" puts up a Cloudflare "Verify you are human" box.
 * This adapter does not touch it, look inside it, or try to make it go away.
 * The tab is brought to the front, the panel says "tick the box", and the
 * person ticks it. Nothing here is built to get around the check, and nothing
 * should be: that is the line between a tool that helps someone use a site and
 * one that defeats the site.
 *
 * TERMS
 * -----
 * Ahrefs' terms restrict automated access to their tools. This runs one seed
 * at a time, in the user's own browser, at the pace a person clicks, with the
 * person clearing every check — but whether that is acceptable use is the
 * user's call, and `legal: 'user-tab'` records that rather than pretending the
 * question does not exist.
 *
 * NOT YET VERIFIED
 * ----------------
 * The results table was not seen when this was written (the human check stood
 * in the way), so `driveAhrefs` reads tables generically — any table, or ARIA
 * grid, whose header has a "Keyword" column — and maps Volume / KD / Updated by
 * header text. If Ahrefs renders results as something else, the lookup comes
 * back as `drift` with what it did find, not as an empty success.
 */

import type { Country, KeywordRow, LookupOutcome, Source } from '../lib/keywords'

const PAGE = 'https://ahrefs.com/keyword-generator/'

/** Long enough for a person to notice the tab and tick the box. */
const TIMEOUT_MS = 4 * 60 * 1000

/** Pause between seeds, so a sheet does not hammer the page. */
const BETWEEN_SEEDS_MS = 4000

/** What the injected function hands back. Plain data — it crosses a process. */
type DriveResult =
  | {
      kind: 'ok'
      tables: Array<{ label: string; rows: Array<{ keyword: string; volume: string; kd: string; updated: string }> }>
    }
  | { kind: 'timeout'; note: string }
  | { kind: 'drift'; expected: string; found: string }

/**
 * Runs INSIDE the Ahrefs tab, via chrome.scripting.executeScript.
 *
 * It is serialised with `toString()`, so it must be fully self-contained: no
 * imports, no helpers from this module, nothing captured from outside. Every
 * helper it uses is declared inside it.
 *
 * Selectors are by text, placeholder and role, never by class — the page's
 * classes are generated CSS-in-JS hashes (`css-79elbk-selectItem`) that change
 * with every deploy. The one exception is the `selectItem` fragment, which is
 * the component's name rather than its hash.
 */
async function driveAhrefs(keyword: string, countryNames: string[], timeoutMs: number): Promise<DriveResult> {
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
  const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()
  const say = (text: string) => {
    // Also keeps the service worker alive while a person deals with the check.
    chrome.runtime.sendMessage({ channel: 'kw:tab-status', text }).catch(() => {})
  }

  /** React ignores `el.value = x`; the native setter plus an input event is what it hears. */
  const setValue = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  const waitFor = async <T,>(fn: () => T | null | undefined, ms: number): Promise<T | null> => {
    const end = Date.now() + ms
    while (Date.now() < end) {
      const v = fn()
      if (v) return v
      await sleep(200)
    }
    return null
  }

  /* ---- the form ------------------------------------------------------ */

  const input = await waitFor(
    () =>
      document.querySelector<HTMLInputElement>('input[placeholder="Enter keyword"]') ??
      document.querySelector<HTMLInputElement>('form input[type="text"]'),
    20000,
  )
  if (!input) return { kind: 'drift', expected: 'a keyword box', found: document.title }

  const form = input.closest('form')
  const buttons = () => [...(form ?? document).querySelectorAll<HTMLButtonElement>('button')]
  const submit = () =>
    buttons().find((b) => b.type === 'submit') ?? buttons().find((b) => /find keywords/i.test(b.textContent ?? ''))
  // The country picker sits immediately before the submit button.
  const countryButton = () => {
    const all = buttons()
    const i = all.indexOf(submit()!)
    return i > 0 ? all[i - 1] : undefined
  }

  if (norm(input.value) !== norm(keyword)) setValue(input, keyword)

  /* ---- the country --------------------------------------------------- */

  const wanted = countryNames.map(norm)
  const countryOk = () => wanted.includes(norm(countryButton()?.textContent))

  if (!countryOk()) {
    countryButton()?.click()
    const search = await waitFor(() => document.querySelector<HTMLInputElement>('input[placeholder="Search"]'), 3000)
    for (const name of countryNames) {
      if (countryOk()) break
      if (search) {
        setValue(search, name)
        await sleep(400)
      }
      const item = [...document.querySelectorAll<HTMLElement>('[class*="selectItem"]')].find((el) =>
        wanted.includes(norm(el.textContent)),
      )
      if (item) {
        // The option is a wrapper; only its inner button responds to a click.
        ;(item.querySelector('button') ?? item).click()
        await sleep(400)
      }
    }
    if (!countryOk()) {
      return { kind: 'drift', expected: `country "${countryNames[0]}"`, found: countryButton()?.textContent?.trim() ?? 'no country picker' }
    }
  }

  /* ---- results -------------------------------------------------------- */

  const cellsOf = (row: Element) =>
    [...row.querySelectorAll('th, td, [role="cell"], [role="gridcell"], [role="columnheader"]')].map(
      (c) => ((c as HTMLElement).innerText ?? c.textContent ?? '').split('\n')[0]!.trim(),
    )

  /** Nearest heading above a table — "Keyword ideas", "Questions", … */
  const labelFor = (el: Element, n: number) => {
    let node: Element | null = el
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      let sib = node.previousElementSibling
      while (sib) {
        const h = sib.matches('h1,h2,h3,h4,h5') ? sib : sib.querySelector('h1,h2,h3,h4,h5')
        const t = h?.textContent?.trim()
        if (t && t.length < 80) return t
        sib = sib.previousElementSibling
      }
    }
    return `Table ${n}`
  }

  const read = () => {
    const tables: Array<{ label: string; rows: Array<{ keyword: string; volume: string; kd: string; updated: string }> }> = []
    const grids = [...document.querySelectorAll('table, [role="table"], [role="grid"]')].filter(
      (g) => !g.parentElement?.closest('table, [role="table"], [role="grid"]'),
    )
    grids.forEach((grid, n) => {
      const rows = [...grid.querySelectorAll('tr, [role="row"]')]
      const headIdx = rows.findIndex((r) => cellsOf(r).some((c) => /keyword/i.test(c)))
      if (headIdx === -1) return
      const head = cellsOf(rows[headIdx]!).map((c) => c.toLowerCase())
      const col = (re: RegExp) => head.findIndex((h) => re.test(h))
      const k = col(/keyword/)
      const v = col(/volume/)
      const d = col(/^kd$|difficulty/)
      const u = col(/updated/)
      const out = rows
        .slice(headIdx + 1)
        .map(cellsOf)
        .map((c) => ({ keyword: c[k] ?? '', volume: v >= 0 ? (c[v] ?? '') : '', kd: d >= 0 ? (c[d] ?? '') : '', updated: u >= 0 ? (c[u] ?? '') : '' }))
        .filter((r) => r.keyword && !/^keyword/i.test(r.keyword))
      if (out.length) tables.push({ label: labelFor(grid, n + 1), rows: out })
    })
    return tables
  }

  // Results already on the page (the URL alone ran the search) — no click needed.
  if (!read().length) {
    say('Pressing "Find keywords"…')
    submit()?.click()
  }

  const start = Date.now()
  let lastCount = -1
  let stableFor = 0
  let lastSaid = 0

  while (Date.now() - start < timeoutMs) {
    const tables = read()
    const count = tables.reduce((n, t) => n + t.rows.length, 0)

    // Tables fill in progressively; wait until the count stops moving.
    if (count > 0 && count === lastCount) {
      if (++stableFor >= 3) return { kind: 'ok', tables }
    } else stableFor = 0
    lastCount = count

    if (Date.now() - lastSaid > 8000) {
      lastSaid = Date.now()
      const waited = Math.round((Date.now() - start) / 1000)
      say(
        count
          ? `Reading results… ${count} so far`
          : waited < 6
            ? 'Waiting for Ahrefs…'
            : `Waiting ${waited}s — tick "Verify you are human" in the Ahrefs tab. If nothing is there, click "Find keywords".`,
      )
    }
    await sleep(1000)
  }

  return {
    kind: 'timeout',
    note: `no results table after ${Math.round(timeoutMs / 60000)} min — the human check was not completed, or the page changed`,
  }
}

/* ------------------------------------------------------------------ *
 * Worker side
 * ------------------------------------------------------------------ */

function tabLoaded(tabId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      chrome.tabs.onUpdated.removeListener(onUpdated)
      chrome.tabs.onRemoved.removeListener(onRemoved)
    }
    const onUpdated = (id: number, info: chrome.tabs.TabChangeInfo) => {
      if (id === tabId && info.status === 'complete') {
        cleanup()
        resolve()
      }
    }
    const onRemoved = (id: number) => {
      if (id === tabId) {
        cleanup()
        reject(new Error('the Ahrefs tab was closed'))
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated)
    chrome.tabs.onRemoved.addListener(onRemoved)
    void chrome.tabs.get(tabId).then((t) => {
      if (t.status === 'complete') {
        cleanup()
        resolve()
      }
    })
  })
}

/** "3.6K" -> 3600, "1,200" -> 1200. Ranges and "<10" stay text only. */
function parseVolume(s: string): number | undefined {
  const m = s.replace(/,/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*([km]?)$/i)
  if (!m) return undefined
  const mult = { k: 1e3, m: 1e6 }[m[2]!.toLowerCase() as 'k' | 'm'] ?? 1
  return Math.round(Number(m[1]) * mult)
}

function parseKd(s: string): number | undefined {
  const m = s.trim().match(/^(\d{1,3})$/)
  return m ? Number(m[1]) : undefined
}

let lastLookupAt = 0

export const ahrefsGenerator: Source = {
  id: 'ahrefs-generator',
  name: 'Ahrefs Keyword Generator',
  blurb:
    'Keyword ideas with volume and KD, read from ahrefs.com in a tab you can see. You tick the “Verify you are human” box when it appears.',
  provides: ['volume', 'difficulty'],
  legal: 'user-tab',
  needsTab: true,

  async lookup(seed: string, country: Country, signal?: AbortSignal): Promise<LookupOutcome> {
    const wait = lastLookupAt + BETWEEN_SEEDS_MS - Date.now()
    if (wait > 0) await new Promise((r) => setTimeout(r, wait))

    const url = `${PAGE}?country=${encodeURIComponent(country.code)}&input=${encodeURIComponent(seed)}`
    // Foreground on purpose: the person has to see this tab to tick the box.
    const tab = await chrome.tabs.create({ url, active: true })
    const tabId = tab.id!
    const closeTab = () => void chrome.tabs.remove(tabId).catch(() => {})
    signal?.addEventListener('abort', closeTab, { once: true })

    try {
      await tabLoaded(tabId)
      const [injected] = await chrome.scripting.executeScript({
        target: { tabId },
        func: driveAhrefs,
        args: [seed, [country.name, ...(country.aliases ?? [])], TIMEOUT_MS],
      })
      const res = injected?.result as DriveResult | undefined
      lastLookupAt = Date.now()

      if (!res) return { kind: 'failed', reason: 'the Ahrefs tab returned nothing' }
      if (res.kind === 'drift') return res
      if (res.kind === 'timeout') return { kind: 'handoff', reason: 'human-check', url, note: res.note }

      const at = Date.now()
      const rows: KeywordRow[] = []
      const seen = new Set<string>()
      for (const t of res.tables) {
        for (const r of t.rows) {
          const key = `${t.label}|${r.keyword.toLowerCase()}`
          if (seen.has(key)) continue
          seen.add(key)
          rows.push({
            keyword: r.keyword,
            seed,
            country: country.code,
            list: t.label,
            volume: parseVolume(r.volume),
            volumeText: r.volume || undefined,
            difficulty: parseKd(r.kd),
            difficultyText: r.kd || undefined,
            updated: r.updated || undefined,
            source: 'ahrefs-generator',
            at,
          })
        }
      }
      closeTab()
      return { kind: 'ok', rows }
    } catch (e) {
      if (signal?.aborted) return { kind: 'failed', reason: 'stopped' }
      return { kind: 'failed', reason: String(e).slice(0, 160) }
    } finally {
      signal?.removeEventListener('abort', closeTab)
    }
  },
}
