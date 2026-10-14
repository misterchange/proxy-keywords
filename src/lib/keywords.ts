/**
 * The shape of the work: seed keywords in, keyword data out.
 *
 * Deliberately source-agnostic. The same `KeywordRow` comes back whether the
 * numbers were read out of Google Keyword Planner, pulled from an autocomplete
 * endpoint, or bought from an API — because the thing that makes this product
 * survivable is being able to change where the data comes from without
 * rewriting the sheet handling, the UI, or the export.
 *
 * That is not a theoretical nicety. The first source anyone reaches for is a
 * competitor's free tool, and free tools are lead magnets: they are rate
 * limited, their terms forbid automated access, and they are withdrawn without
 * notice. A product whose only supply is someone else's loss-leader is one
 * policy change away from having no product.
 */

/* Countries a lookup can be scoped to. ISO 3166-1 alpha-2, lowercased, which
 * is what Google's `gl` parameter and most keyword APIs expect. */
export interface Country {
  code: string
  name: string
  /** Default language for this market — Google's `hl`. */
  hl: string
  /** Other spellings a sheet might use in a column header. */
  aliases?: string[]
}

export const COUNTRIES: Country[] = [
  // The ten markets in the VidHaul sheet come first, in its column order —
  // that sheet is the real input this was built against.
  { code: 'in', name: 'India', hl: 'en', aliases: ['bharat'] },
  { code: 'us', name: 'United States', hl: 'en', aliases: ['usa', 'america'] },
  { code: 'id', name: 'Indonesia', hl: 'id' },
  { code: 'br', name: 'Brazil', hl: 'pt', aliases: ['brasil'] },
  { code: 'mx', name: 'Mexico', hl: 'es', aliases: ['méxico'] },
  { code: 'ph', name: 'Philippines', hl: 'en' },
  { code: 'vn', name: 'Vietnam', hl: 'vi', aliases: ['viet nam'] },
  { code: 'tr', name: 'Turkey', hl: 'tr', aliases: ['türkiye', 'turkiye'] },
  { code: 'bd', name: 'Bangladesh', hl: 'en' },
  { code: 'pk', name: 'Pakistan', hl: 'en' },
  { code: 'eg', name: 'Egypt', hl: 'ar' },
  { code: 'sa', name: 'Saudi Arabia', hl: 'ar' },
  // Everything else, for sheets that are not that one.
  { code: 'gb', name: 'United Kingdom', hl: 'en', aliases: ['uk', 'britain'] },
  { code: 'ca', name: 'Canada', hl: 'en' },
  { code: 'au', name: 'Australia', hl: 'en' },
  { code: 'de', name: 'Germany', hl: 'de', aliases: ['deutschland'] },
  { code: 'fr', name: 'France', hl: 'fr' },
  { code: 'es', name: 'Spain', hl: 'es', aliases: ['españa'] },
  { code: 'it', name: 'Italy', hl: 'it', aliases: ['italia'] },
  { code: 'nl', name: 'Netherlands', hl: 'nl' },
  { code: 'ae', name: 'United Arab Emirates', hl: 'en', aliases: ['uae'] },
  { code: 'sg', name: 'Singapore', hl: 'en' },
  { code: 'za', name: 'South Africa', hl: 'en' },
  { code: 'jp', name: 'Japan', hl: 'ja' },
  { code: 'ng', name: 'Nigeria', hl: 'en' },
  { code: 'ru', name: 'Russia', hl: 'ru' },
]

export function countryFor(code: string): Country | undefined {
  return COUNTRIES.find((c) => c.code === code.toLowerCase())
}

/**
 * Resolve whatever a human typed into a country.
 *
 * Takes a code ("in"), a name ("India"), an alias ("USA"), or a spreadsheet
 * column header with a language hint and a newline in it:
 *
 *   "India\n(en (+hi))"            -> in
 *   "Bangladesh / Pakistan\n(en)"  -> bd  (see `countriesFromHeader`)
 *   "Egypt / Saudi Arabia\n(ar)"   -> eg
 *
 * The parenthetical is dropped rather than parsed for language. It is a note
 * to whoever reads the sheet about which languages matter in that market, and
 * guessing an `hl` from "en (+hi)" would pick one and silently ignore the
 * other. The country's own default is used, and a sheet that wants Hindi
 * results should say so in a column of its own.
 */
/**
 * Strip parenthetical language hints, including nested ones.
 *
 * `/\([^)]*\)/` is not enough and the failure is silent: "India
(en (+hi))"
 * has a nested group, so a single pass eats "(en (+hi)" and leaves a stray
 * ")" behind — "india )" then matches no country, and that column's seeds are
 * dropped from the run without a word. It cost India and Pakistan on the first
 * real sheet. Removing innermost groups repeatedly handles any depth.
 */
function stripHints(raw: string): string {
  let out = raw
  for (let i = 0; i < 5; i++) {
    const next = out.replace(/\([^()]*\)/g, ' ')
    if (next === out) break
    out = next
  }
  // Any unbalanced bracket left over is noise, not part of a country name.
  return out.replace(/[()]/g, ' ')
}

export function resolveCountry(raw: string): Country | undefined {
  const cleaned = stripHints(raw)
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
  if (!cleaned) return undefined

  /*
   * Locale strings name a country in their second half: en-IN, en_US, pt-BR.
   * Exported sheets are full of them, and the leading language must not be
   * read as the country — "en-IN" is India, not England.
   */
  const locale = cleaned.match(/^[a-z]{2,3}[-_]([a-z]{2})$/)
  if (locale) {
    const byRegion = COUNTRIES.find((c) => c.code === locale[1])
    if (byRegion) return byRegion
  }

  return (
    COUNTRIES.find((c) => c.code === cleaned) ??
    COUNTRIES.find((c) => c.name.toLowerCase() === cleaned) ??
    COUNTRIES.find((c) => c.aliases?.includes(cleaned))
  )
}

/**
 * A header can name more than one market: "Bangladesh / Pakistan" is one
 * column of seeds meant for two countries.
 *
 * Both are returned, and the caller emits one lookup per country. They are
 * separate markets with separate results — collapsing them to the first would
 * silently drop half the research the sheet asked for.
 */
export function countriesFromHeader(raw: string): Country[] {
  const withoutHint = stripHints(raw)
  const parts = withoutHint.split(/[/,]|\bor\b/i)
  const found = parts.map((p) => resolveCountry(p)).filter((c): c is Country => !!c)
  // Deduplicate while keeping order.
  return found.filter((c, i) => found.findIndex((x) => x.code === c.code) === i)
}

/**
 * One keyword, as far as we actually know it.
 *
 * Every metric is optional on purpose. Sources disagree about what they can
 * supply — an autocomplete endpoint gives you the phrase and nothing else, a
 * planner gives volume and competition, a paid API adds difficulty and CPC —
 * and a row that carries `volume: 0` because nobody measured it is a lie the
 * user will act on. Undefined means "not measured"; zero means "measured, and
 * it is zero".
 */
export interface KeywordRow {
  keyword: string
  /** The seed this was expanded from, so results can be grouped. */
  seed: string
  country: string
  /**
   * Carried through from the sheet so a 10,000-row export can be pivoted back
   * to the thing it was researched for. Without these the output is a flat
   * list nobody can map to a build plan.
   */
  tool?: string
  group?: string
  batch?: string
  /** Monthly searches. Undefined = this source does not provide it. */
  volume?: number
  /** 0-100, however the source defines it. `difficultySource` says who said so. */
  difficulty?: number
  /** Cost per click in the source's currency. */
  cpc?: number
  currency?: string
  /** 'low' | 'medium' | 'high', as planners report it. */
  competition?: string
  /** Which adapter produced this row — shown in the export, never guessed. */
  source: string
  /** When it was read. Keyword data goes stale; an undated number is a trap. */
  at: number
}

export type LookupOutcome =
  | { kind: 'ok'; rows: KeywordRow[] }
  /** The source wants a human — sign-in, a human check, a quota wall. */
  | { kind: 'handoff'; reason: HandoffReason; url: string; note?: string }
  /** The page no longer looks like what the adapter was written against. */
  | { kind: 'drift'; expected: string; found: string }
  | { kind: 'failed'; reason: string }

export type HandoffReason =
  | 'needs-sign-in'
  | 'human-check'
  | 'quota-reached'
  | 'rate-limited'

/**
 * A place keyword data can come from.
 *
 * `legal` is a required field rather than a comment because this is the
 * decision that sinks products in this category, and it should be impossible
 * to add a source without stating it.
 */
export interface Source {
  id: string
  name: string
  /** One line for the UI. */
  blurb: string
  /**
   * What this source supplies. The UI greys out columns a source cannot fill
   * rather than showing empty cells that look like missing data.
   */
  provides: Array<'volume' | 'difficulty' | 'cpc' | 'competition'>
  /**
   * Whether automated access is permitted, and on whose say-so.
   *
   *   'public-endpoint' — a documented public endpoint with no terms against it
   *   'own-account'     — the user's own logged-in account on a service that
   *                       allows them to read their own data
   *   'licensed-api'    — a paid API whose terms cover this use
   *   'prohibited'      — terms forbid automated access. Must not ship.
   */
  legal: 'public-endpoint' | 'own-account' | 'licensed-api' | 'prohibited'
  /** Does a run need a tab, or can the worker fetch it directly? */
  needsTab: boolean
  /** Expand one seed. Country is always explicit; there is no "global". */
  lookup(seed: string, country: Country, signal?: AbortSignal): Promise<LookupOutcome>
}
