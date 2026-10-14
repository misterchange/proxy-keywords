# Proxy Keywords

A Chrome extension (MV3) that turns a spreadsheet of seed keywords into
country-scoped keyword research.

Upload a sheet, pick a market, export a CSV. Third in the family after
Proxy Director (video) and Proxy Poster (directory submissions), and built
on the same shape: a side panel, a service worker, and a pluggable adapter
per data source.

## What it does today

- **Reads almost any sheet.** Columns are inferred from the cells, not the
  header names — a matrix with one column per country, a keyword column plus
  a country column, or a bare list all work. Locales (`en-IN`), country names,
  aliases (`USA`, `Türkiye`) and combined headers (`Egypt / Saudi Arabia`)
  all resolve. A title and instructions above the header are fine.
- **Google Autocomplete** as the first source: the long tail and the
  questions, genuinely scoped by country. No account, no key, no quota.
- **CSV export** carrying `tool`, `group` and `batch` from the input sheet,
  plus `source` and `read_at` on every row.

## What it does not do

- **No search volume.** Autocomplete does not carry it, and no row from that
  source ever sets a `volume` field. A fabricated number is worse than a blank
  one. See `ROADMAP` in `src/lib/registry.ts` for the sources that would add it
  — Google Keyword Planner (free, the user's own Ads account) is the obvious
  next one.
- **No scraping of competitors' free tools.** `src/lib/registry.ts` carries a
  `REJECTED` list with the reasoning. Short version: their terms forbid it,
  free tiers are capped lead magnets, and a product whose supply is someone
  else's loss-leader has no supply.

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
src/adapters/          One file per source
src/background/        Service worker: runs lookups, owns the run
src/sidepanel/         The only UI
```
