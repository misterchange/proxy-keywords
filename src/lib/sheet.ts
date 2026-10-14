/**
 * Seeds from a spreadsheet — in either of the two shapes people actually use.
 *
 * MATRIX (what the VidHaul sheet is, and the shape this was rebuilt around)
 *
 *     #  | Tool        | Group         | Batch | India        | USA          | …
 *     1  | MP4 to MP3  | A. Converters | 1     | mp4 to mp3   | mp4 to mp3   | …
 *
 *   One row per thing you are researching, one COLUMN per country, and the
 *   cell is the localised seed for that market. Several seeds in one cell are
 *   separated by " | ". Thirty-two tools across ten country columns is 320
 *   cells and ~390 lookups, which is why the count is shown before anything
 *   runs.
 *
 * LONG (the shape a simpler sheet takes)
 *
 *     keyword          | country
 *     protein powder   | in
 *
 * Both reduce to the same `SeedRow[]`. The format is detected, never asked
 * about — a person who has just dragged in a file should not have to tell the
 * tool what kind of file it is.
 *
 * Neither shape assumes the header is row 1. Real sheets open with a title and
 * a paragraph of instructions; the VidHaul one puts its header on row 4.
 */

import * as XLSX from 'xlsx'
import { countriesFromHeader, resolveCountry } from './keywords'
import { inferColumns } from './infer'

export interface SeedRow {
  /** 1-based row in the sheet, for error messages. */
  row: number
  keyword: string
  /** Lowercased ISO code. Undefined means "use the run's default". */
  country?: string
  /** Matrix sheets carry these; they ride through to the export. */
  tool?: string
  group?: string
  batch?: string
}

export interface SheetParse {
  rows: SeedRow[]
  problems: string[]
  countries: string[]
  /** Which shape was detected, so the UI can say what it understood. */
  shape: 'matrix' | 'long' | 'list'
  /**
   * How the columns were chosen, in words.
   *
   * Shown in the UI before a run. A guess that is wrong is cheap to correct
   * when it is visible and expensive when it is silent — "column 3 looks like
   * the keywords" lets someone catch it in a second.
   */
  readAs?: string
  /** Batches present, when the sheet has them — lets the UI offer a filter. */
  batches: string[]
}

const norm = (h: string) => h.toLowerCase().replace(/[\s_\-\n]+/g, '')

const KEYWORD_HEADERS = [
  'keyword', 'keywords', 'seed', 'seedkeyword', 'query', 'term', 'phrase',
  'searchterm', 'searchphrase', 'searchquery', 'focuskw', 'focuskeyword',
  'targetkeyword', 'primarykeyword', 'kw', 'topic',
]
const COUNTRY_HEADERS = [
  'country', 'market', 'geo', 'location', 'countrycode', 'region',
  'targetmarket', 'locale', 'territory', 'geotarget',
]
const META = { tool: ['tool', 'name', 'page', 'product', 'feature'], group: ['group', 'category', 'cluster'], batch: ['batch', 'phase', 'priority', 'wave'] }

/** Several seeds in one cell: "video to mp3 | extract audio from video". */
const splitSeeds = (cell: string) =>
  cell
    .split('|')
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

/**
 * Find the header row.
 *
 * Scans the first fifteen rows for the one that looks like headings rather
 * than assuming row 1. A row qualifies if it names a keyword column, or if it
 * names at least two countries — which is what a matrix header looks like and
 * what a title row never does.
 */
function findHeader(grid: string[][]): { index: number; cells: string[] } | null {
  for (let i = 0; i < Math.min(grid.length, 15); i++) {
    const cells = grid[i] ?? []
    const normed = cells.map(norm)
    if (normed.some((c) => KEYWORD_HEADERS.includes(c))) return { index: i, cells }
    const countryish = cells.filter((c) => c.trim() && countriesFromHeader(c).length > 0)
    if (countryish.length >= 2) return { index: i, cells }
  }
  return null
}

function fromGrid(grid: string[][]): SheetParse {
  const problems: string[] = []
  const rows: SeedRow[] = []
  const nonEmpty = grid.filter((r) => r.some((c) => (c ?? '').trim() !== ''))

  if (!nonEmpty.length) {
    return { rows, problems: ['The file is empty.'], countries: [], shape: 'list', batches: [] }
  }

  const header = findHeader(nonEmpty)

  /* ---- no header at all: read the columns from the data --------------- */
  if (!header) {
    const guess = inferColumns(nonEmpty)

    /*
     * `findHeader` only recognises a header it can name — a keyword alias, or
     * two countries. A row reading "Focus KW | Target Market | Owner" is none
     * of those, so it reaches here as data and "Focus KW" becomes a seed we
     * look up. It did, in testing.
     *
     * The tell is the country column: if one was inferred and nearly every
     * row resolves there except the first, the first row is labels. That is
     * evidence from the data rather than another list of header names to keep
     * up to date.
     */
    let data = nonEmpty
    if (guess?.country !== undefined && nonEmpty.length > 2) {
      const col = guess.country
      const firstResolves = Boolean(resolveCountry(nonEmpty[0]?.[col] ?? ''))
      const rest = nonEmpty.slice(1)
      const restResolve = rest.filter((r) => resolveCountry(r[col] ?? '')).length / rest.length
      if (!firstResolves && restResolve >= 0.6) data = rest
    }
    if (!guess) {
      return {
        rows,
        problems: ['Could not tell which column holds the keywords. Add a header row, or put keywords in the first column.'],
        countries: [],
        shape: 'list',
        batches: [],
      }
    }

    const seen = new Set<string>()
    data.forEach((cells, i) => {
      const country = guess.country === undefined ? undefined : resolveCountry(cells[guess.country] ?? '')?.code
      for (const kw of splitSeeds(cells[guess.keyword] ?? '')) {
        const key = `${kw.toLowerCase()}|${country ?? ''}`
        if (seen.has(key)) continue
        seen.add(key)
        rows.push({ row: i + 1, keyword: kw, country })
      }
    })

    if (!rows.length) problems.push('No keywords found in the column that looked most like them.')
    return {
      rows,
      problems,
      countries: [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))],
      shape: 'list',
      batches: [],
      readAs:
        (data.length < nonEmpty.length ? 'First row looked like labels and was skipped. ' : 'No header row. ') +
        `${guess.why}.`,
    }
  }

  const normed = header.cells.map(norm)
  const body = nonEmpty.slice(header.index + 1)
  const colOf = (aliases: string[]) => {
    for (const a of aliases) {
      const i = normed.indexOf(a)
      if (i !== -1) return i
    }
    return undefined
  }

  const kwCol = colOf(KEYWORD_HEADERS)
  const toolCol = colOf(META.tool)
  const groupCol = colOf(META.group)
  const batchCol = colOf(META.batch)

  /*
   * Country columns. A header cell counts only if it resolves to a country AND
   * is not already serving as a metadata column — "Group" and "Region" are
   * close enough in spirit that an over-eager match would turn a metadata
   * column into ten thousand lookups.
   */
  const countryCols: Array<{ index: number; codes: string[] }> = []
  header.cells.forEach((cell, i) => {
    if (i === kwCol || i === toolCol || i === groupCol || i === batchCol) return
    if (COUNTRY_HEADERS.includes(normed[i] ?? '')) return
    const found = countriesFromHeader(cell)
    if (found.length) countryCols.push({ index: i, codes: found.map((c) => c.code) })
  })

  const cellAt = (cells: string[], idx: number | undefined) =>
    idx === undefined ? '' : (cells[idx] ?? '').replace(/\s+/g, ' ').trim()

  const seen = new Set<string>()
  const add = (r: SeedRow) => {
    const key = `${r.keyword.toLowerCase()}|${r.country ?? ''}`
    if (seen.has(key)) return
    seen.add(key)
    rows.push(r)
  }

  /* ---- matrix: one column per country --------------------------------- */
  if (countryCols.length >= 2) {
    body.forEach((cells, i) => {
      const row = header.index + i + 2
      const tool = cellAt(cells, toolCol) || undefined
      const group = cellAt(cells, groupCol) || undefined
      const batch = cellAt(cells, batchCol) || undefined

      for (const col of countryCols) {
        const raw = cellAt(cells, col.index)
        if (!raw) continue
        for (const kw of splitSeeds(raw)) {
          // A combined header ("Bangladesh / Pakistan") is two markets, so the
          // same seed is looked up once per country.
          for (const code of col.codes) add({ row, keyword: kw, country: code, tool, group, batch })
        }
      }
    })

    if (!rows.length) problems.push('Found country columns but no seed keywords under them.')

    return {
      rows,
      problems,
      countries: [...new Set(rows.map((r) => r.country!).filter(Boolean))],
      shape: 'matrix',
      batches: [...new Set(rows.map((r) => r.batch).filter((b): b is string => !!b))].sort(),
      readAs: `${countryCols.length} country column${countryCols.length === 1 ? '' : 's'} found in the header.`,
    }
  }

  /* ---- long: a keyword column, maybe a country column ----------------- */
  const headerCt = colOf(COUNTRY_HEADERS)

  /*
   * The header named neither. Fall back to reading the data — "Search term",
   * "Focus KW", "Target" and a hundred other headings are all keyword columns
   * that no alias list will ever cover, and the cells underneath say so
   * plainly.
   */
  const guess = kwCol === undefined ? inferColumns(body, { keyword: kwCol, country: headerCt }) : null
  if (kwCol === undefined && !guess) {
    return {
      rows,
      problems: [
        'Could not tell which column holds the keywords. Name a column "keyword", or give one column per country.',
      ],
      countries: [],
      shape: 'long',
      batches: [],
    }
  }

  const keywordAt = kwCol ?? guess!.keyword
  const ctCol = headerCt ?? guess?.country
  const readAs = guess ? `Header did not name a keyword column — ${guess.why}.` : undefined
  body.forEach((cells, i) => {
    const row = header.index + i + 2
    const raw = cellAt(cells, keywordAt)
    if (!raw) {
      problems.push(`Row ${row}: no keyword.`)
      return
    }

    let country: string | undefined
    const rawCountry = cellAt(cells, ctCol)
    if (rawCountry) {
      const resolved = resolveCountry(rawCountry)
      if (!resolved) {
        problems.push(`Row ${row}: country "${rawCountry}" is not one we support.`)
        return
      }
      country = resolved.code
    }

    for (const kw of splitSeeds(raw)) {
      add({ row, keyword: kw, country, tool: cellAt(cells, toolCol) || undefined, group: cellAt(cells, groupCol) || undefined, batch: cellAt(cells, batchCol) || undefined })
    }
  })

  if (!rows.length && !problems.length) problems.push('No rows with a keyword were found.')

  return {
    rows,
    problems,
    countries: [...new Set(rows.map((r) => r.country).filter((c): c is string => !!c))],
    shape: 'long',
    batches: [...new Set(rows.map((r) => r.batch).filter((b): b is string => !!b))].sort(),
    readAs,
  }
}

/** RFC-4180-ish CSV: quoted fields, doubled quotes, newlines inside quotes. */
export function parseCsvText(text: string): string[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const delim = (first.match(/\t/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? '\t' : ','

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } else quoted = false
      } else field += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === delim) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

export async function parseSeedFile(file: File): Promise<SheetParse> {
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(file.name)) {
    const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' })

    /*
     * First sheet with seeds in it, not simply the first sheet. The VidHaul
     * workbook carries a "Research tracker" tab of Done/Pending cells beside
     * the seeds, and a workbook whose tabs are ordered the other way round
     * would otherwise parse the tracker and find nothing.
     */
    let best: SheetParse | null = null
    for (const name of wb.SheetNames) {
      const grid = XLSX.utils
        .sheet_to_json<string[]>(wb.Sheets[name]!, { header: 1, raw: false, defval: '' })
        .map((r) => r.map((c) => String(c ?? '')))
      const parsed = fromGrid(grid)
      if (parsed.rows.length && (!best || parsed.rows.length > best.rows.length)) best = parsed
    }
    return best ?? { rows: [], problems: ['No sheet in that workbook had seed keywords in it.'], countries: [], shape: 'list', batches: [] }
  }

  return fromGrid(parseCsvText(await file.text()))
}

export const SHEET_HINT =
  'Almost any shape works. One column per country, or a keyword column and a country column, or just a list of ' +
  'keywords. Headers can be named anything — the columns are worked out from the cells. Several seeds in one ' +
  'cell separate with " | ". A title and instructions above the header are fine.'

export const SHEET_TEMPLATE_CSV = [
  '#,Tool,Group,Batch,India,USA,Indonesia,Brazil',
  '1,MP4 to MP3,A. Converters,1,mp4 to mp3,mp4 to mp3,mp4 ke mp3,converter mp4 para mp3',
  '2,Video to MP3,A. Converters,1,video to mp3 | extract audio from video,video to mp3,video ke mp3,converter vídeo para mp3',
  '3,Video compressor,C. Video editing,2,compress video,compress video,kompres video,comprimir vídeo',
].join('\n')

/* ------------------------------------------------------------------ *
 * Export
 * ------------------------------------------------------------------ */

const esc = (v: unknown) => {
  const s = v === undefined || v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/**
 * Results to CSV.
 *
 * `tool`, `group` and `batch` lead, so a ten-thousand-row export pivots
 * straight back to the build plan it came from. `source` and `read_at` are
 * columns rather than a footnote: keyword data goes stale and sources
 * disagree, and an undated number is one someone is still pasting into a deck
 * six months later.
 */
export function toCsv(rows: import('./keywords').KeywordRow[]): string {
  const head = ['tool', 'group', 'batch', 'country', 'seed', 'keyword', 'volume', 'difficulty', 'cpc', 'currency', 'competition', 'source', 'read_at']
  const body = rows.map((r) =>
    [r.tool, r.group, r.batch, r.country, r.seed, r.keyword, r.volume, r.difficulty, r.cpc, r.currency, r.competition, r.source, new Date(r.at).toISOString()]
      .map(esc)
      .join(','),
  )
  return [head.join(','), ...body].join('\n')
}
