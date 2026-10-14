/**
 * Side panel — the only UI.
 *
 * Holds no authoritative state: the run lives in chrome.storage because MV3
 * kills the worker mid-sheet and the panel is closed for most of a run. The
 * file itself is read here, though — only a page with a real file input can
 * touch the disk, and the worker never sees anything but validated rows.
 */

import { COUNTRIES, type KeywordRow } from '../lib/keywords'
import { DEFAULT_SOURCE_ID, REJECTED, ROADMAP, SOURCES } from '../lib/registry'
import { SHEET_HINT, SHEET_TEMPLATE_CSV, parseSeedFile, toCsv, type SheetParse } from '../lib/sheet'

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!

/** The panel is also opened as a plain page to check layout. */
const hasChrome = typeof chrome !== 'undefined' && !!chrome.storage?.local

interface Run {
  sourceId: string
  seeds: unknown[]
  done: number
  status: string
  rows: KeywordRow[]
  notes: Array<{ seed: string; kind: string; detail: string }>
}

let parsed: SheetParse | null = null
let fileName = ''

/* ---- views ---------------------------------------------------------- */

for (const tab of document.querySelectorAll<HTMLButtonElement>('.seg.views button')) {
  tab.addEventListener('click', () => {
    for (const t of document.querySelectorAll('.seg.views button')) t.classList.toggle('on', t === tab)
    $('#run').hidden = tab.dataset.view !== 'run'
    $('#sources').hidden = tab.dataset.view !== 'sources'
  })
}

/* ---- pickers -------------------------------------------------------- */

const countrySel = $<HTMLSelectElement>('#country')
for (const c of COUNTRIES) {
  const o = document.createElement('option')
  o.value = c.code
  o.textContent = c.name
  countrySel.append(o)
}
countrySel.value = 'us'

const sourceSel = $<HTMLSelectElement>('#source')
for (const s of SOURCES) {
  const o = document.createElement('option')
  o.value = s.id
  o.textContent = s.name
  sourceSel.append(o)
}
sourceSel.value = DEFAULT_SOURCE_ID

/**
 * Say what a source cannot do, next to the choice.
 *
 * `provides` is empty for autocomplete, and a tool that quietly shows an empty
 * Volume column invites the user to assume the number is zero. Saying "no
 * volume" before the run is the honest version.
 */
function describeSource(): void {
  const s = SOURCES.find((x) => x.id === sourceSel.value)
  if (!s) return
  const missing = (['volume', 'difficulty', 'cpc', 'competition'] as const).filter((m) => !s.provides.includes(m))
  $('#source-note').textContent = missing.length
    ? `${s.blurb} Does not provide: ${missing.join(', ')}.`
    : s.blurb
}
sourceSel.addEventListener('change', describeSource)
describeSource()

$('#sheet-hint').textContent = SHEET_HINT

/* ---- file ----------------------------------------------------------- */

const fileInput = $<HTMLInputElement>('#file')
$('#choose').addEventListener('click', () => fileInput.click())

$('#template').addEventListener('click', () => {
  const url = URL.createObjectURL(new Blob([SHEET_TEMPLATE_CSV], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = 'proxy-keywords-seeds.csv'
  a.click()
  URL.revokeObjectURL(url)
})

$('#change').addEventListener('click', () => {
  parsed = null
  fileName = ''
  fileInput.value = ''
  $('#loaded').hidden = true
  $('#pick').hidden = false
  refreshGo()
})

fileInput.addEventListener('change', async () => {
  const f = fileInput.files?.[0]
  if (!f) return
  fileName = f.name

  /*
   * A file that cannot be read must say so. A damaged workbook, a .xlsx that
   * is really HTML, a CSV saved in an encoding the reader chokes on — each
   * throws out of the parser, and an unhandled rejection in a change handler
   * leaves the panel sitting there looking like nothing happened. Observed:
   * feeding it a 404 page produced total silence.
   */
  try {
    parsed = await parseSeedFile(f)
  } catch (e) {
    parsed = {
      rows: [],
      problems: [`Could not read ${f.name} — ${e instanceof Error ? e.message : String(e)}`],
      countries: [],
      shape: 'list',
      batches: [],
    }
  }

  $('#pick').hidden = true
  $('#loaded').hidden = false
  $('#filename').textContent = fileName

  const probs = $<HTMLUListElement>('#problems')
  probs.innerHTML = ''
  probs.hidden = parsed.problems.length === 0
  for (const p of parsed.problems.slice(0, 6)) {
    const li = document.createElement('li')
    li.textContent = p
    probs.append(li)
  }

  const countries = parsed.countries.length ? parsed.countries.join(', ') : countrySel.value
  $('#summary').textContent = parsed.problems.length
    ? ''
    : `${parsed.rows.length} seed${parsed.rows.length === 1 ? '' : 's'} · ${countries}`
  refreshGo()
})

function refreshGo(): void {
  const ok = Boolean(parsed && parsed.rows.length && !parsed.problems.length && hasChrome)
  $<HTMLButtonElement>('#go').disabled = !ok
}

/* ---- run ------------------------------------------------------------ */

$('#go').addEventListener('click', async () => {
  if (!parsed) return
  await chrome.runtime.sendMessage({
    channel: 'kw:start',
    seeds: parsed.rows,
    sourceId: sourceSel.value,
    defaultCountry: countrySel.value,
  })
})

$('#stop').addEventListener('click', () => void chrome.runtime.sendMessage({ channel: 'kw:abort' }))

$('#clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ channel: 'kw:clear' })
  render(null)
})

$('#export').addEventListener('click', async () => {
  const { run } = (await chrome.runtime.sendMessage({ channel: 'kw:get' })) as { run: Run | null }
  if (!run?.rows.length) return
  const url = URL.createObjectURL(new Blob([toCsv(run.rows)], { type: 'text/csv' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `keywords-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
})

/* ---- render --------------------------------------------------------- */

function render(run: Run | null): void {
  const running = run?.status === 'running'
  $('#stop').hidden = !running
  $('#progress').hidden = !run
  $('#results').hidden = !run || !run.rows.length

  if (!run) {
    $('#count').textContent = ''
    return
  }

  const total = run.seeds.length || 1
  $<HTMLElement>('#bar-fill').style.width = `${Math.round((run.done / total) * 100)}%`
  $('#progress-note').textContent =
    `${run.done}/${run.seeds.length} seeds · ${run.rows.length} keywords` +
    (running ? ' · working…' : ` · ${run.status}`)
  $('#count').textContent = `${run.rows.length} keywords`

  // A sample, not the lot. Thousands of <li> in a 380px panel is a scroll
  // nobody reads; the CSV is where the full set is meant to be looked at.
  const list = $<HTMLUListElement>('#kw')
  list.innerHTML = ''
  for (const r of run.rows.slice(0, 60)) {
    const li = document.createElement('li')
    const k = document.createElement('span')
    k.className = 'kw-text'
    k.textContent = r.keyword
    const c = document.createElement('span')
    c.className = 'kw-tag'
    c.textContent = r.country
    li.append(k, c)
    list.append(li)
  }
  $('#res-count').textContent =
    run.rows.length > 60 ? `${run.rows.length} keywords — first 60 shown` : `${run.rows.length} keywords`

  const notes = $<HTMLUListElement>('#notes')
  notes.innerHTML = ''
  notes.hidden = run.notes.length === 0
  for (const n of run.notes.slice(0, 8)) {
    const li = document.createElement('li')
    li.textContent = `${n.seed}: ${n.kind.replace(/-/g, ' ')} — ${n.detail}`
    notes.append(li)
  }
}

if (hasChrome) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.channel === 'kw:run') render(msg.run as Run)
  })
  void chrome.runtime.sendMessage({ channel: 'kw:get' }).then((r) => render((r as { run: Run | null })?.run ?? null))
}

/* ---- sources tab ---------------------------------------------------- */

const LEGAL_LABEL: Record<string, string> = {
  'public-endpoint': 'public endpoint',
  'own-account': 'your own account',
  'licensed-api': 'licensed API',
  prohibited: 'not permitted',
}

function card(title: string, tag: string, body: string): HTMLLIElement {
  const li = document.createElement('li')
  li.className = 'src'
  const h = document.createElement('div')
  h.className = 'src-head'
  const n = document.createElement('span')
  n.className = 'src-name'
  n.textContent = title
  const t = document.createElement('span')
  t.className = 'src-tag'
  t.textContent = tag
  h.append(n, t)
  const p = document.createElement('p')
  p.className = 'src-body'
  p.textContent = body
  li.append(h, p)
  return li
}

for (const s of SOURCES) {
  const missing = (['volume', 'difficulty', 'cpc', 'competition'] as const).filter((m) => !s.provides.includes(m))
  $('#srcs').append(
    card(s.name, LEGAL_LABEL[s.legal] ?? s.legal, `${s.blurb}${missing.length ? ` Does not provide: ${missing.join(', ')}.` : ''}`),
  )
}
for (const r of REJECTED) $('#rejected').append(card(r.name, 'not used', r.why))
for (const r of ROADMAP) $('#roadmap').append(card(r.name, LEGAL_LABEL[r.legal] ?? r.legal, `${r.gives} ${r.cost}`))

refreshGo()
