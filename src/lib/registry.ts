/**
 * Where keyword data can come from.
 *
 * Only sources whose `legal` is not 'prohibited' are ever runnable —
 * `sourceFor` refuses the rest, so a prohibited entry cannot be reached by
 * selecting it in the UI, by a stale id in storage, or by a future caller who
 * did not read this file.
 *
 * The prohibited entries are kept rather than deleted on purpose, so the
 * reasoning lives next to the code rather than in someone's memory.
 *
 * Ahrefs used to be listed there. It is now a source (`ahrefsGenerator`) in a
 * narrower form: its own page, in a tab the user can see, one seed at a time,
 * with the user ticking the Cloudflare check by hand. Nothing in this repo
 * gets past that check for them, and nothing should.
 */

import type { Source } from './keywords'
import { ahrefsGenerator } from '../adapters/ahrefsGenerator'
import { googleSuggest } from '../adapters/googleSuggest'

export const SOURCES: Source[] = [ahrefsGenerator, googleSuggest]

/**
 * Considered and rejected, with the reason.
 *
 * These are not "not built yet" — they are "must not be built this way".
 */
export const REJECTED: Array<{ name: string; url: string; why: string }> = [
  {
    name: 'Semrush / Moz / Ubersuggest free tiers',
    url: '',
    why: 'Capped free tools behind sign-in, with terms against automation. Their paid APIs are fine — see below.',
  },
]

/**
 * Sources worth building next, in the order I would build them.
 *
 * Listed in code because the choice of source is the product decision here,
 * not a detail: everything else in this repo works whichever one is plugged in.
 */
export const ROADMAP: Array<{ name: string; legal: Source['legal']; gives: string; cost: string }> = [
  {
    name: 'Google Keyword Planner (user’s own Google Ads account)',
    legal: 'own-account',
    gives: 'Real monthly volume ranges, competition and CPC, per country. The number people actually want.',
    cost: 'Free. Needs a Google Ads account; volumes are banded until the account has spend.',
  },
  {
    name: 'Google Trends',
    legal: 'public-endpoint',
    gives: 'Relative interest over time and by region — direction, not absolute volume.',
    cost: 'Free.',
  },
  {
    name: 'DataForSEO',
    legal: 'licensed-api',
    gives: 'Volume, CPC, difficulty, SERP data. Terms explicitly cover resale.',
    cost: 'Pay per call, cents. The honest answer for a paid product.',
  },
]

export function sourceFor(id: string): Source | undefined {
  const s = SOURCES.find((x) => x.id === id)
  if (!s) return undefined
  // Belt and braces: a prohibited source must not be runnable even if one is
  // ever added to SOURCES by mistake.
  return s.legal === 'prohibited' ? undefined : s
}

export const DEFAULT_SOURCE_ID = ahrefsGenerator.id
