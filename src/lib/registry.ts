/**
 * Where keyword data can come from.
 *
 * Only sources whose `legal` is not 'prohibited' are ever runnable —
 * `sourceFor` refuses the rest, so a prohibited entry cannot be reached by
 * selecting it in the UI, by a stale id in storage, or by a future caller who
 * did not read this file.
 *
 * The prohibited entries are kept rather than deleted on purpose. "Why don't
 * we just scrape Ahrefs?" is a question that gets asked once a month; the
 * answer should live next to the code rather than in someone's memory of a
 * conversation.
 */

import type { Source } from './keywords'
import { googleSuggest } from '../adapters/googleSuggest'

export const SOURCES: Source[] = [googleSuggest]

/**
 * Considered and rejected, with the reason.
 *
 * These are not "not built yet" — they are "must not be built this way".
 */
export const REJECTED: Array<{ name: string; url: string; why: string }> = [
  {
    name: 'Ahrefs free keyword generator',
    url: 'https://ahrefs.com/keyword-generator/',
    why:
      "Terms forbid automated access, the free tier is a capped lead magnet, and it is fronted by a human check. " +
      'Getting past that check is the only way in, and defeating a bot check is not something this project does — ' +
      'not as a policy nicety, but because the ban lands on the user whose browser made the request, and because a ' +
      'product whose supply is a competitor’s loss-leader has no supply at all. Repeated challenges are the ' +
      'symptom of rate limiting, and evasion makes rate limiting worse, not better.',
  },
  {
    name: 'Semrush / Moz / Ubersuggest free tiers',
    url: '',
    why: 'Same shape as Ahrefs: capped free tools behind sign-in, terms against automation. Their paid APIs are fine — see below.',
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

export const DEFAULT_SOURCE_ID = googleSuggest.id
