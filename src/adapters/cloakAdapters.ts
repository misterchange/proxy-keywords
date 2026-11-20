// src/adapters/cloakAdapters.ts

import type { Country, KeywordRow, LookupOutcome, Source } from '../lib/keywords';

/**
 * CloakBrowser (Playwright) based fetch for Google Suggest.
 * This mirrors the behavior of the existing googleSuggest adapter but runs headlessly.
 */
export const cloakedGoogleSuggest: Source = {
  id: 'cloak-google-suggest',
  name: 'Google Autocomplete (CloakBrowser)',
  blurb: 'Uses CloakBrowser (Playwright) to fetch suggestions headlessly, avoiding detection.',
  provides: [],
  legal: 'public-endpoint',
  needsTab: false,
  async lookup(seed: string, country: Country, signal?: AbortSignal): Promise<LookupOutcome> {
    const SUFFIXES = [
      '',
      ...'abcdefghijklmnopqrstuvwxyz'.split(''),
      'how', 'what', 'why', 'when', 'where', 'which', 'who',
      'best', 'top', 'cheap', 'free', 'near me', 'vs', 'for', 'without', 'online', 'price',
    ];
    const ENDPOINT = 'https://suggestqueries.google.com/complete/search';
    const DELAY_MS = 120;

    const found = new Map<string, KeywordRow>();
    const at = Date.now();
    let failures = 0;

    // Lazy import CloakBrowser to avoid loading it unless needed.
    const { launch } = await import('cloakbrowser');
    const browser = await launch({ headless: true });
    const page = await browser.newPage();

    try {
      for (const suffix of SUFFIXES) {
        if (signal?.aborted) break;
        const q = suffix ? `${seed} ${suffix}` : seed;
        const url = `${ENDPOINT}?client=chrome&gl=${encodeURIComponent(country.code)}&hl=${encodeURIComponent(country.hl)}&q=${encodeURIComponent(q)}`;
        try {
          const raw = await page.evaluate(async (u: string) => {
            const res = await fetch(u);
            const txt = await res.text();
            return txt;
          }, url);
          const parsed = JSON.parse(raw) as unknown;
          if (Array.isArray(parsed) && Array.isArray((parsed as any)[1])) {
            const suggestions = (parsed as any)[1] as unknown[];
            for (const s of suggestions) {
              if (typeof s !== 'string') continue;
              const key = s.toLowerCase();
              if (found.has(key)) continue;
              found.set(key, {
                keyword: s,
                seed,
                country: country.code,
                source: 'cloak-google-suggest',
                at,
              });
            }
          }
        } catch (e) {
          if (signal?.aborted) break;
          failures++;
          if (failures > 8) {
            return found.size
              ? { kind: 'ok', rows: [...found.values()] }
              : { kind: 'handoff', reason: 'rate-limited', url, note: String(e).slice(0, 120) };
          }
        }
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
      return { kind: 'ok', rows: [...found.values()] };
    } finally {
      await browser.close();
    }
  },
};

/**
 * Direct replacement for the fetch‑based Google Suggest implementation, using CloakBrowser.
 */
export async function replaceGoogleSuggestWithCloak(
  seed: string,
  country: Country,
  signal?: AbortSignal,
): Promise<LookupOutcome> {
  return cloakedGoogleSuggest.lookup(seed, country, signal);
}

/**
 * Simple background service using CloakBrowser.
 * Accepts an arbitrary URL and returns the raw text response.
 */
export async function runCloakBackgroundService(url: string, signal?: AbortSignal): Promise<string> {
  const { launch } = await import('cloakbrowser');
  const browser = await launch({ headless: true });
  const page = await browser.newPage();
  try {
    const result = await page.evaluate(async (u: string) => {
      const res = await fetch(u);
      return await res.text();
    }, url);
    return result as string;
  } finally {
    await browser.close();
  }
}
