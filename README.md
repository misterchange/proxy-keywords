# Proxy Keywords

A Chrome extension (MV3) that turns a spreadsheet of seed keywords into
country-scoped keyword research.

Upload a sheet, pick a market, export a CSV. Third in the family after
Proxy Director (video) and Proxy Poster (directory submissions), and built
on the same shape: a side panel, a service worker, and a pluggable adapter
per data source.

## What it does today

- **Type a keyword, pick a country, get Excel.** The side panel takes one
  keyword (or several, one per line), a country, and a source, and the
  result downloads as an `.xlsx` (CSV still available).
- **Ahrefs Keyword Generator** (default source): opens
  `ahrefs.com/keyword-generator/?country=<cc>&input=<keyword>` in a tab you
  can see, presses "Find keywords", and reads the results table: keyword,
  volume, KD, and which list (ideas / questions) each came from.
  **Ahrefs puts up a Cloudflare "Verify you are human" box. You tick it.**
  The extension never touches it, and nothing here tries to get past it. The
  panel tells you when it is waiting on you. Ahrefs' terms restrict automated
  access, so using this source is your call.
- **Google Autocomplete**: the long tail and the questions, scoped by
  country. No account, no key, no quota, no volume.
- **Reads almost any sheet** for bulk runs. Columns are inferred from the
  cells, not the header names.

## Known gaps

- The Ahrefs results-table reader was written without seeing the table (the
  human check was in the way), so it matches any table whose header has a
  "Keyword" column. If Ahrefs changes its markup, the run reports `drift`
  instead of returning an empty file. Fix it in
  `src/adapters/ahrefsGenerator.ts` (`driveAhrefs`).
- Autocomplete rows have no volume. See `ROADMAP` in `src/lib/registry.ts`.

## Build

```bash
npm install
npm run build        # -> dist/
```

Load `dist/` at `chrome://extensions` with Developer mode on.

`npm run dev` writes to `dist-dev/` on purpose — a CRXJS dev build's service
worker imports from the dev server, so sharing an output directory with the
production build leaves a dead extension the moment the server stops.

## Layout

```
src/lib/keywords.ts    Country list, KeywordRow, the Source interface
src/lib/sheet.ts       Sheet parsing and CSV export
src/lib/infer.ts       Works out which column is which, from the cells
src/lib/registry.ts    Available sources, rejected sources, roadmap
src/adapters/          One file per source (ahrefsGenerator drives a tab)
src/background/        Service worker: runs lookups, owns the run
src/sidepanel/         The only UI
```
