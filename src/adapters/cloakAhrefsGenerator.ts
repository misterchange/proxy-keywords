// src/adapters/cloakAhrefsGenerator.ts

import type { Country, KeywordRow, LookupOutcome, Source } from '../lib/keywords';
import { chromium } from 'playwright-core';
import fs from 'fs';
import path from 'path';

let lastLookupAt = 0;

export const cloakedAhrefsGenerator: Source = {
  id: 'cloak-ahrefs-generator',
  name: 'Ahrefs Keyword Generator (CloakBrowser)',
  blurb: 'Uses stealth persistent browser context to fetch keyword ideas from Ahrefs without manual solvers.',
  provides: ['volume', 'difficulty'],
  legal: 'public-endpoint',
  needsTab: false,
  async lookup(seed: string, country: Country, signal?: AbortSignal): Promise<LookupOutcome> {
    const PAGE = 'https://ahrefs.com/keyword-generator/';
    const TIMEOUT_MS = 60 * 1000;
    const BETWEEN_SEEDS_MS = 3000;

    // Rate-limit between seeds
    const wait = (lastLookupAt + BETWEEN_SEEDS_MS) - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));

    const defaultChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cloakBinary = path.join(process.env.USERPROFILE || '', '.cloakbrowser', 'chromium-146.0.7680.177.5', 'chrome.exe');
    const executablePath = fs.existsSync(cloakBinary)
      ? cloakBinary
      : (process.env.CLOAKBROWSER_BINARY_PATH || defaultChrome);

    const userDataDir = path.resolve(process.cwd(), `.cloak-profile-${Date.now()}`);
    let context: any;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        context = await chromium.launchPersistentContext(userDataDir, {
          executablePath,
          headless: false,
          ignoreDefaultArgs: ['--enable-automation'],
          args: [
            '--disable-blink-features=AutomationControlled',
            '--no-sandbox',
            '--start-maximized',
          ],
          viewport: null,
        });
        break;
      } catch (err: any) {
        if (attempt === 3) throw err;
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const page = context.pages()[0] || (await context.newPage());

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      (window as any).chrome = (window as any).chrome || { runtime: {} };
    });

    try {
      const url = `${PAGE}?country=${encodeURIComponent(country.code)}&input=${encodeURIComponent(seed)}`;
      await page.goto(url, { waitUntil: 'load' });

      // Dismiss cookie banner if present
      try {
        await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const accept = btns.find((b) => /accept all|accept/i.test(b.textContent || ''));
          if (accept) (accept as HTMLElement).click();
        });
      } catch (e) {
        // Non-fatal
      }

      // Wait for modal or auto-rendered tables from URL
      let ready = false;
      for (let w = 0; w < 5; w++) {
        ready = await page.evaluate(() => {
          return Array.from(document.querySelectorAll('.ReactModalPortal')).some((p) => (p as HTMLElement).innerText?.includes('Keyword ideas'));
        });
        if (ready) break;
        await page.waitForTimeout(1000);
      }

      // If still not ready after 5s, fill input and submit
      if (!ready) {
        await page.evaluate(({ keyword }: { keyword: string }) => {
          const input = document.querySelector<HTMLInputElement>('input[placeholder="Enter keyword"]') ??
            document.querySelector<HTMLInputElement>('form input[type="text"]');
          if (input && input.value !== keyword) {
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, keyword);
            input.dispatchEvent(new Event('input', { bubbles: true }));
          }

          const submit = Array.from(document.querySelectorAll('button')).find(
            (b) => b.type === 'submit' || /find keywords/i.test(b.textContent ?? '')
          );
          if (submit) (submit as HTMLElement).click();
        }, { keyword: seed });
      }

      // Poll for results
      const start = Date.now();
      let lastCount = -1;
      let stableFor = 0;

      while (Date.now() - start < TIMEOUT_MS) {
        if (signal?.aborted) {
          return { kind: 'failed', reason: 'lookup aborted' };
        }

        const pollResult = await page.evaluate(() => {
          const bodyText = document.body.innerText || '';
          const hasFailed = /verification failed/i.test(bodyText);

          const portal = Array.from(document.querySelectorAll('.ReactModalPortal')).find((p) => (p as HTMLElement).innerText?.includes('Keyword ideas'));
          if (!portal) return { hasFailed, tables: [] };

          const cellsOf = (row: Element) =>
            Array.from(row.querySelectorAll('th, td, [role="cell"], [role="gridcell"]')).map(
              (c) => ((c as HTMLElement).innerText ?? c.textContent ?? '').split('\n')[0]!.trim()
            );

          const allRows = Array.from(portal.querySelectorAll('tr, [role="row"]'));
          let k = 0, d = 1, v = 2, u = 3;
          for (const r of allRows) {
            const c = cellsOf(r).map((x) => x.toLowerCase());
            if (c.some((x) => /keyword/i.test(x))) {
              k = c.findIndex((x) => /keyword/i.test(x));
              d = c.findIndex((x) => /^kd$|difficulty/i.test(x));
              v = c.findIndex((x) => /volume/i.test(x));
              u = c.findIndex((x) => /updated/i.test(x));
              break;
            }
          }

          const out: Array<{ keyword: string; volume: string; kd: string; updated: string }> = [];
          for (const r of allRows) {
            const c = cellsOf(r);
            if (c.length < 2) continue;
            const kw = c[k] || '';
            if (!kw || /keyword/i.test(kw) || /firehose|starter plan|sign up|turn a keyword/i.test(kw)) continue;
            out.push({
              keyword: kw,
              kd: d >= 0 ? (c[d] ?? '') : '',
              volume: v >= 0 ? (c[v] ?? '') : '',
              updated: u >= 0 ? (c[u] ?? '') : '',
            });
          }

          return { hasFailed, tables: out.length ? [{ label: 'Phrase match', rows: out }] : [] };
        });

        const count = pollResult.tables.reduce((n: number, t: any) => n + t.rows.length, 0);

        if (count > 0 && count === lastCount) {
          if (++stableFor >= 2) {
            // Also fetch Questions tab if present
            let questionTables: Array<{ label: string; rows: Array<{ keyword: string; volume: string; kd: string; updated: string }> }> = [];
            try {
              const clickedQuestions = await page.evaluate(() => {
                const portal = Array.from(document.querySelectorAll('.ReactModalPortal')).find((p) => (p as HTMLElement).innerText?.includes('Keyword ideas'));
                const container = portal || document;
                const btns = Array.from(container.querySelectorAll('button, [role="tab"], [role="button"]'));
                const btn = btns.find((b) => /questions/i.test(b.textContent || ''));
                if (btn) {
                  (btn as HTMLElement).click();
                  return true;
                }
                return false;
              });

              if (clickedQuestions) {
                await page.waitForTimeout(2500);
                questionTables = await page.evaluate(() => {
                  const portal = Array.from(document.querySelectorAll('.ReactModalPortal')).find((p) => (p as HTMLElement).innerText?.includes('Keyword ideas'));
                  const container = portal || document;

                  const cellsOf = (row: Element) =>
                    Array.from(row.querySelectorAll('th, td, [role="cell"], [role="gridcell"]')).map(
                      (c) => ((c as HTMLElement).innerText ?? c.textContent ?? '').split('\n')[0]!.trim()
                    );

                  const allRows = Array.from(container.querySelectorAll('tr, [role="row"]'));
                  let k = 0, d = 1, v = 2, u = 3;
                  for (const r of allRows) {
                    const c = cellsOf(r).map((x) => x.toLowerCase());
                    if (c.some((x) => /keyword/i.test(x))) {
                      k = c.findIndex((x) => /keyword/i.test(x));
                      d = c.findIndex((x) => /^kd$|difficulty/i.test(x));
                      v = c.findIndex((x) => /volume/i.test(x));
                      u = c.findIndex((x) => /updated/i.test(x));
                      break;
                    }
                  }

                  const out: Array<{ keyword: string; volume: string; kd: string; updated: string }> = [];
                  for (const r of allRows) {
                    const c = cellsOf(r);
                    if (c.length < 2) continue;
                    const kw = c[k] || '';
                    if (!kw || /keyword/i.test(kw) || /firehose|starter plan|sign up|turn a keyword/i.test(kw)) continue;
                    out.push({
                      keyword: kw,
                      kd: d >= 0 ? (c[d] ?? '') : '',
                      volume: v >= 0 ? (c[v] ?? '') : '',
                      updated: u >= 0 ? (c[u] ?? '') : '',
                    });
                  }

                  return out.length ? [{ label: 'Questions', rows: out }] : [];
                });
              }
            } catch (e) {
              // Questions extraction is non-blocking
            }

            const at = Date.now();
            const rows: KeywordRow[] = [];
            const seen = new Set<string>();

            const parseVolume = (s: string): number | undefined => {
              const m = s.replace(/[>,]/g, '').trim().match(/^(\d+(?:\.\d+)?)\s*([km]?)$/i);
              if (!m) return undefined;
              const mult = { k: 1e3, m: 1e6 }[m[2]!.toLowerCase() as 'k' | 'm'] ?? 1;
              return Math.round(Number(m[1]) * mult);
            };

            const parseKd = (s: string): number | undefined => {
              const m = s.trim().match(/^(\d{1,3})$/);
              return m ? Number(m[1]) : undefined;
            };

            const combinedTables = [
              ...pollResult.tables.map((t: any) => ({ ...t, label: 'Phrase match' })),
              ...questionTables,
            ];

            for (const t of combinedTables) {
              for (const r of t.rows) {
                const key = `${t.label}|${r.keyword.toLowerCase()}`;
                if (seen.has(key)) continue;
                seen.add(key);
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
                  source: 'cloak-ahrefs-generator',
                  at,
                });
              }
            }

            lastLookupAt = Date.now();
            return { kind: 'ok', rows };
          }
        } else if (count > 0) {
          stableFor = 0;
          lastCount = count;
        } else if (pollResult.hasFailed) {
          return {
            kind: 'failed',
            reason: 'Cloudflare Turnstile verification failed. Cloudflare flagged the automated browser.',
          };
        }

        await new Promise((r) => setTimeout(r, 1000));
      }

      return { kind: 'handoff', reason: 'human-check', url, note: `no results after ${Math.round(TIMEOUT_MS / 60000)} min` };
    } finally {
      await context.close().catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }
  },
};
