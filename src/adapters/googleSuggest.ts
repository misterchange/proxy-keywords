/**
 * Google Autocomplete — the first source, and the one that needs nothing.
 *
 * No account, no API key, no human check, no rate-limit wall at the volumes a
 * person working through a spreadsheet produces. It is the documented
 * autocomplete endpoint the browser's own address bar uses, and it answers
 * plain GETs with JSON.
 *
 * Verified against the live endpoint on 15 Oct 2026, and it is genuinely
 * country-scoped rather than nominally so: `gl=in` for "protein powder"
 * returns "protein powder mumbai" and "protein powder pune", which `gl=us`
 * does not. That is the whole point of the product, so it was worth checking
 * rather than assuming.
 *
 * WHAT IT CANNOT TELL YOU
 * -----------------------
 * Search volume. Not approximately, not as a range — the endpoint does not
 * carry it. `provides` says so, the UI greys the column out, and no row from
 * here ever sets `volume`. An invented number is worse than a blank one: a
 * blank prompts a question, a fabricated 2,400 gets pasted into a client deck.
 *
 * What it IS good for is the shape of demand — the long tail, the questions,
 * the local modifiers. For most seeds that is the larger half of the work, and
 * volume can be added afterwards from a source that actually measures it.
 */

import type { Country, KeywordRow, LookupOutcome, Source } from '../lib/keywords'

const ENDPOINT = 'https://suggestqueries.google.com/complete/search'

/*
 * Alphabet expansion. One bare query returns ~10 suggestions; appending each
 * letter in turn ("seed a", "seed b", …) is the standard way to widen that to
 * a few hundred, because the endpoint completes on the prefix.
 *
 * Question words are included explicitly rather than hoped for: "how", "why",
 * "best", "vs" surface the intent-bearing phrases that an a-to-z sweep often
 * buries, and they are what someone doing keyword research is actually after.
 */
const SUFFIXES = [
  '',
  ...'abcdefghijklmnopqrstuvwxyz'.split(''),
  'how', 'what', 'why', 'when', 'where', 'which', 'who',
  'best', 'top', 'cheap', 'free', 'near me', 'vs', 'for', 'without', 'online', 'price',
]

/** Be a good neighbour: one request at a time, with a pause between. */
const DELAY_MS = 120

async function suggest(seed: string, suffix: string, country: Country, signal?: AbortSignal): Promise<string[]> {
  const q = suffix ? `${seed} ${suffix}` : seed
  const url = `${ENDPOINT}?client=chrome&gl=${encodeURIComponent(country.code)}&hl=${encodeURIComponent(country.hl)}&q=${encodeURIComponent(q)}`

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`suggest returned ${res.status}`)

  /*
   * The response is JSON but served as text/javascript, so `res.json()` is
   * not reliable across browsers. Shape is [query, [suggestions], …].
   */
  const parsed = JSON.parse(await res.text()) as unknown
  if (!Array.isArray(parsed) || !Array.isArray(parsed[1])) return []
  return (parsed[1] as unknown[]).filter((s): s is string => typeof s === 'string')
}

export const googleSuggest: Source = {
  id: 'google-suggest',
  name: 'Google Autocomplete',
  blurb: 'The long tail and the questions, scoped to a country. No volume.',
  provides: [],
  legal: 'public-endpoint',
  needsTab: false,

  async lookup(seed: string, country: Country, signal?: AbortSignal): Promise<LookupOutcome> {
    const found = new Map<string, KeywordRow>()
    const at = Date.now()
    let failures = 0

    for (const suffix of SUFFIXES) {
      if (signal?.aborted) break
      try {
        for (const phrase of await suggest(seed, suffix, country, signal)) {
          const key = phrase.toLowerCase()
          if (found.has(key)) continue
          found.set(key, {
            keyword: phrase,
            seed,
            country: country.code,
            source: 'google-suggest',
            at,
          })
        }
      } catch (e) {
        if (signal?.aborted) break
        failures++
        /*
         * A handful of misses across forty requests is normal and not worth
         * failing a seed over. A wall of them means something changed —
         * usually that we are being throttled — and that is worth saying
         * rather than returning a quietly short list.
         */
        if (failures > 8) {
          return found.size
            ? { kind: 'ok', rows: [...found.values()] }
            : { kind: 'handoff', reason: 'rate-limited', url: ENDPOINT, note: String(e).slice(0, 120) }
        }
      }
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }

    return { kind: 'ok', rows: [...found.values()] }
  },
}
