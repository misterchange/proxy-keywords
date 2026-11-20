// chrome-extension/background.js

// This background service worker implements the Ahrefs Keyword Generator using
// the same DOM‑scraping logic that the Node version uses. It runs inside the
// Chrome extension environment and uses the Chrome scripting API to inject a
// function into the Ahrefs page.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action !== 'lookupAhrefs') {
    sendResponse({ error: 'unknown action' });
    return true; // keep channel open
  }

  const { seed, country } = message;
  const PAGE = 'https://ahrefs.com/keyword-generator/';
  const TIMEOUT_MS = 4 * 60 * 1000;

  // Helper to wait for a tab to finish loading.
  const waitForTab = (tabId) =>
    new Promise((resolve, reject) => {
      const onUpdated = (id, info) => {
        if (id === tabId && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(onUpdated);
          resolve();
        }
      };
      const onRemoved = (id) => {
        if (id === tabId) {
          chrome.tabs.onRemoved.removeListener(onRemoved);
          reject(new Error('tab closed'));
        }
      };
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.onRemoved.addListener(onRemoved);
    });

  // Main async flow.
  (async () => {
    try {
      // Open the Ahrefs page with query parameters.
      const url = `${PAGE}?country=${encodeURIComponent(country.code)}&input=${encodeURIComponent(seed)}`;
      const tab = await chrome.tabs.create({ url, active: false });
      const tabId = tab.id;
      await waitForTab(tabId);

      // The driver function that runs inside the page context.
      const driveAhrefs = (keyword, countryNames, timeoutMs) => {
        const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
        const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
        const setValue = (el, v) => {
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const waitFor = async (fn, ms) => {
          const end = Date.now() + ms;
          while (Date.now() < end) {
            const v = fn();
            if (v) return v;
            await sleep(200);
          }
          return null;
        };

        // ---- locate input field ----
        const input = await waitFor(
          () =>
            document.querySelector('input[placeholder="Enter keyword"]') ||
            document.querySelector('form input[type="text"]'),
          20000,
        );
        if (!input) return { kind: 'drift', expected: 'a keyword box', found: document.title };

        const form = input.closest('form');
        const buttons = () => [...(form ?? document).querySelectorAll('button')];
        const submit = () =>
          buttons().find((b) => b.type === 'submit') ||
          buttons().find((b) => /find keywords/i.test(b.textContent ?? ''));
        const countryButton = () => {
          const all = buttons();
          const i = all.indexOf(submit());
          return i > 0 ? all[i - 1] : undefined;
        };

        if (norm(input.value) !== norm(keyword)) setValue(input, keyword);

        // ---- set country ----
        const wanted = countryNames.map(norm);
        const countryOk = () => wanted.includes(norm(countryButton()?.textContent));
        if (!countryOk()) {
          countryButton()?.click();
          const search = await waitFor(() => document.querySelector('input[placeholder="Search"]'), 3000);
          for (const name of countryNames) {
            if (countryOk()) break;
            if (search) {
              setValue(search, name);
              await sleep(400);
            }
            const item = [...document.querySelectorAll('[class*="selectItem"]')].find((el) =>
              wanted.includes(norm(el.textContent)),
            );
            if (item) {
              (item.querySelector('button') ?? item).click();
              await sleep(400);
            }
          }
          if (!countryOk())
            return { kind: 'drift', expected: `country "${countryNames[0]}"`, found: countryButton()?.textContent?.trim() ?? 'no country picker' };
        }

        // ---- read tables ----
        const read = () => {
          const tables = [];
          const grids = [...document.querySelectorAll('table, [role="table"], [role="grid"]')].filter(
            (g) => !g.parentElement?.closest('table, [role="table"], [role="grid"]'),
          );
          const cellsOf = (row) =>
            [...row.querySelectorAll('th, td, [role="cell"], [role="gridcell"], [role="columnheader"]')].map(
              (c) => ((c).innerText ?? c.textContent ?? '').split('\n')[0].trim(),
            );
          const labelFor = (el, n) => {
            let node = el;
            for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
              let sib = node.previousElementSibling;
              while (sib) {
                const h = sib.matches('h1,h2,h3,h4,h5') ? sib : sib.querySelector('h1,h2,h3,h4,h5');
                const t = h?.textContent?.trim();
                if (t && t.length < 80) return t;
                sib = sib.previousElementSibling;
              }
            }
            return `Table ${n}`;
          };
          grids.forEach((grid, n) => {
            const rows = [...grid.querySelectorAll('tr, [role="row"]')];
            const headIdx = rows.findIndex((r) => cellsOf(r).some((c) => /keyword/i.test(c)));
            if (headIdx === -1) return;
            const head = cellsOf(rows[headIdx]).map((c) => c.toLowerCase());
            const col = (re) => head.findIndex((h) => re.test(h));
            const k = col(/keyword/), v = col(/volume/), d = col(/^kd$|difficulty/), u = col(/updated/);
            const out = rows
              .slice(headIdx + 1)
              .map(cellsOf)
              .map((c) => ({
                keyword: c[k] ?? '',
                volume: v >= 0 ? (c[v] ?? '') : '',
                kd: d >= 0 ? (c[d] ?? '') : '',
                updated: u >= 0 ? (c[u] ?? '') : '',
              }))
              .filter((r) => r.keyword && !/^keyword/i.test(r.keyword));
            if (out.length) tables.push({ label: labelFor(grid, n + 1), rows: out });
          });
          return tables;
        };

        // Click Find Keywords if needed
        if (!read().length) {
          const sub = submit();
          if (sub) sub.click();
        }

        const start = Date.now();
        let lastCount = -1;
        let stableFor = 0;
        while (Date.now() - start < timeoutMs) {
          const tables = read();
          const count = tables.reduce((n, t) => n + t.rows.length, 0);
          if (count > 0 && count === lastCount) {
            if (++stableFor >= 3) return { kind: 'ok', tables };
          } else stableFor = 0;
          lastCount = count;
          await sleep(1000);
        }
        return { kind: 'timeout', note: `no results after ${Math.round(timeoutMs / 60000)} min` };
      };

      // Execute the driver inside the tab.
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId },
        func: driveAhrefs,
        args: [seed, [country.name, ...(country.aliases ?? [])], TIMEOUT_MS],
      });

      // Close the tab after we have the data.
      await chrome.tabs.remove(tabId);

      sendResponse({ result });
    } catch (e) {
      sendResponse({ error: (e || new Error('unknown')).toString() });
    }
  })();

  // Return true to indicate we will respond asynchronously.
  return true;
});
