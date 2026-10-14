/**
 * Work out which column is the keyword and which is the country, from the
 * cells rather than from the heading.
 *
 * Header matching gets you the tidy sheets. It does not get you "Search term",
 * "Focus KW", "Target", "Query", "Locale", "Market (geo)", a sheet exported
 * from someone else's tool with eleven columns of junk, or a sheet with no
 * header at all. Those all arrive, and a tool that answers them with "could
 * not find a keyword column" has pushed its job back onto the user.
 *
 * So headers are a hint, and the data is the evidence. A column of 30 cells
 * that all resolve to countries IS the country column, whatever it is called;
 * the column with the longest, most varied free text is the keyword column.
 *
 * Every signal here is a fraction of non-empty cells, never a count, so a
 * 12-row sheet and a 4,000-row sheet score the same way.
 */

import { resolveCountry } from './keywords'

export interface ColumnGuess {
  keyword: number
  country?: number
  /** 0-1. Below ~0.5 the caller should say it is unsure rather than proceed. */
  confidence: number
  /** Shown in the UI so a wrong guess is visible before a run, not after. */
  why: string
}

const clean = (s: string) => (s ?? '').replace(/\s+/g, ' ').trim()

/**
 * How country-ish is this column?
 *
 * Deliberately strict about what counts: a column of two-letter codes is
 * only a country column if nearly all of them resolve. "Group" values like
 * "A", "B", "C" must not be mistaken for codes, and they are not, because
 * they do not resolve.
 */
function countryScore(cells: string[]): number {
  const filled = cells.map(clean).filter(Boolean)
  if (filled.length < 2) return 0
  const hits = filled.filter((c) => resolveCountry(c)).length
  return hits / filled.length
}

/**
 * How keyword-ish is this column?
 *
 * Search phrases are multi-word, mostly unique, and longer than labels.
 * Numbers, dates, single repeated tokens and anything that looks like a
 * country are penalised to zero — those are the ID, Batch and Market columns.
 */
function keywordScore(cells: string[]): number {
  const filled = cells.map(clean).filter(Boolean)
  if (filled.length < 1) return 0

  // Numeric or near-numeric columns are never keywords.
  const numeric = filled.filter((c) => /^[\d.,%₹$€\s-]+$/.test(c)).length / filled.length
  if (numeric > 0.6) return 0

  if (countryScore(cells) > 0.5) return 0

  const unique = new Set(filled.map((c) => c.toLowerCase())).size / filled.length
  const avgWords = filled.reduce((n, c) => n + c.split(' ').length, 0) / filled.length
  const avgLen = filled.reduce((n, c) => n + c.length, 0) / filled.length

  // URLs and emails are not search terms, whatever else they are.
  const urlish = filled.filter((c) => /^(https?:\/\/|www\.|\S+@\S+\.)/i.test(c)).length / filled.length
  if (urlish > 0.4) return 0

  // Length is capped so a column of paragraphs does not beat a column of
  // phrases — a description field is long but it is not a keyword.
  const lengthSignal = Math.min(avgLen, 45) / 45
  const wordSignal = Math.min(avgWords, 5) / 5

  return unique * 0.45 + wordSignal * 0.35 + lengthSignal * 0.2
}

/**
 * Pick the keyword and country columns out of a block of rows.
 *
 * `headerHints` are indices the header text already suggested; they break ties
 * but cannot override strong evidence from the data. A column headed
 * "Keyword" that contains dates is not the keyword column, and the sheet is
 * better served by saying so.
 */
export function inferColumns(
  rows: string[][],
  headerHints: { keyword?: number; country?: number } = {},
): ColumnGuess | null {
  const width = rows.reduce((w, r) => Math.max(w, r.length), 0)
  if (!width) return null

  const column = (i: number) => rows.map((r) => r[i] ?? '')

  const countryScores = Array.from({ length: width }, (_, i) => countryScore(column(i)))
  const keywordScores = Array.from({ length: width }, (_, i) => keywordScore(column(i)))

  // Country first — it also tells the keyword search what to avoid.
  let countryIdx: number | undefined
  let bestCountry = 0
  countryScores.forEach((s, i) => {
    const boosted = headerHints.country === i ? s + 0.15 : s
    if (boosted > bestCountry && s >= 0.6) {
      bestCountry = boosted
      countryIdx = i
    }
  })

  let keywordIdx = -1
  let bestKeyword = 0
  keywordScores.forEach((s, i) => {
    if (i === countryIdx) return
    const boosted = headerHints.keyword === i ? s + 0.2 : s
    if (boosted > bestKeyword) {
      bestKeyword = boosted
      keywordIdx = i
    }
  })

  if (keywordIdx === -1 || bestKeyword < 0.25) return null

  const parts = [`column ${keywordIdx + 1} looks like the keywords`]
  if (countryIdx !== undefined) parts.push(`column ${countryIdx + 1} resolves to countries`)
  else parts.push('no country column found — the one picked above will be used for every row')

  return {
    keyword: keywordIdx,
    country: countryIdx,
    confidence: Math.min(1, bestKeyword + (countryIdx !== undefined ? 0.2 : 0)),
    why: parts.join('; '),
  }
}
