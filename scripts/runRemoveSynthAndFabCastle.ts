// scripts/runRemoveSynthAndFabCastle.ts

import fs from 'fs';
import path from 'path';
import * as XLSXModule from 'xlsx';
const XLSX = (XLSXModule as any).default || XLSXModule;
import { cloakedAhrefsGenerator } from '../src/adapters/cloakAhrefsGenerator.ts';
import { countryFor, type Country, type KeywordRow, COUNTRIES } from '../src/lib/keywords.ts';
import { fromGrid, toCsv, toXlsx } from '../src/lib/sheet.ts';

async function processFile(filePath: string, options?: { batch?: string; limit?: number; start?: number }) {
  const resolvedInput = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`File not found: ${resolvedInput}`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(` Starting Research for: ${path.basename(resolvedInput)}`);
  if (options?.batch) console.log(` Filter: Batch ${options.batch}`);
  if (options?.limit) console.log(` Limit:  ${options.limit} seeds`);
  console.log(`======================================================`);

  const wb = XLSX.readFile(resolvedInput);
  const sheetName = wb.SheetNames.includes('Seed keywords') ? 'Seed keywords' : wb.SheetNames[0]!;
  const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName]!, { header: 1, raw: false, defval: '' })
    .map((r) => r.map((c) => String(c ?? '')));

  const parseResult = fromGrid(grid);
  let targetSeeds = parseResult.rows;

  // Optional start offset (1‑based). If provided, skip the first (start‑1) seeds.
  if (options?.start && options.start > 1) {
    const startIdx = options.start - 1;
    targetSeeds = targetSeeds.slice(startIdx);
    console.log(`Starting from seed #${options.start}: ${targetSeeds.length} seeds remaining`);
  }

  if (options?.batch) {
    targetSeeds = targetSeeds.filter((r) => String(r.batch) === String(options.batch));
    console.log(`Filtered to Batch ${options.batch}: ${targetSeeds.length} seeds`);
  }

  if (options?.limit && options.limit > 0) {
    targetSeeds = targetSeeds.slice(0, options.limit);
    console.log(`Limited to first ${targetSeeds.length} seeds`);
  }

  console.log(`Seeds to process: ${targetSeeds.length}`);
  console.log(`Countries: ${parseResult.countries.join(', ')}\n`);

  const allRows: KeywordRow[] = [];
  const defaultCountry: Country = COUNTRIES.find((c) => c.code === 'us') || { code: 'us', name: 'United States', hl: 'en' };

  const outDir = path.resolve(process.cwd(), 'output');
  fs.mkdirSync(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const baseName = path.basename(resolvedInput, path.extname(resolvedInput)).replace(/[^a-zA-Z0-9_-]/g, '_');
  const xlsxPath = path.join(outDir, `${baseName}_keywords_${timestamp}.xlsx`);
  const csvPath = path.join(outDir, `${baseName}_keywords_${timestamp}.csv`);

  const saveCheckpoint = () => {
    if (allRows.length === 0) return;
    try {
      fs.writeFileSync(csvPath, toCsv(allRows), 'utf8');
      fs.writeFileSync(xlsxPath, Buffer.from(toXlsx(allRows)));
    } catch (e) {
      // Non-fatal checkpoint
    }
  };

  for (let i = 0; i < targetSeeds.length; i++) {
    const seed = targetSeeds[i]!;
    const country = (seed.country ? countryFor(seed.country) : undefined) || defaultCountry;

    console.log(`[${i + 1}/${targetSeeds.length}] Querying "${seed.keyword}" (${country.name}) [Tool: ${seed.tool || 'N/A'}]...`);

    try {
      const outcome = await cloakedAhrefsGenerator.lookup(seed.keyword, country);
      if (outcome.kind === 'ok') {
        const enriched = outcome.rows.map((row) => ({
          ...row,
          tool: seed.tool || row.tool,
          group: seed.group || row.group,
          batch: seed.batch || row.batch,
        }));
        allRows.push(...enriched);
        const phraseMatchCount = enriched.filter((r) => r.list === 'Phrase match').length;
        const questionsCount = enriched.filter((r) => r.list === 'Questions').length;
        console.log(`  -> OK: ${enriched.length} keywords found (${phraseMatchCount} Phrase Match, ${questionsCount} Questions)`);
      } else if (outcome.kind === 'failed') {
        console.warn(`  -> Failed: ${outcome.reason}`);
      } else if (outcome.kind === 'drift') {
        console.warn(`  -> Drift: expected ${outcome.expected}, found ${outcome.found}`);
      } else if (outcome.kind === 'handoff') {
        console.warn(`  -> Handoff: ${outcome.reason} (${outcome.note || ''})`);
      }
    } catch (err) {
      console.error(`  -> Error processing "${seed.keyword}":`, err);
    }

    if ((i + 1) % 2 === 0 || i === targetSeeds.length - 1) {
      saveCheckpoint();
    }
  }

  saveCheckpoint();

  console.log(`\n======================================================`);
  console.log(` Completed ${path.basename(resolvedInput)}: ${allRows.length} keywords saved!`);
  console.log(`- Excel: file:///${xlsxPath.replace(/\\/g, '/')}`);
  console.log(`- CSV:   file:///${csvPath.replace(/\\/g, '/')}`);
  console.log(`======================================================\n`);
}

async function main() {
  const args = process.argv.slice(2);
  const targetProject = args[0]?.toLowerCase();
  const startArg = args.find(a => a.startsWith('--start='));
  const start = startArg ? parseInt(startArg.split('=')[1], 10) : undefined;

  if (targetProject === 'removesynth') {
    await processFile('samples/removesynth_seeds.xlsx');
  } else if (targetProject === 'fabcastle') {
    await processFile('samples/fabcastle_seeds.xlsx');
  } else {
    // Run removesynth, then fabcastle
    console.log('Running both RemoveSynth and FabCastle in sequence...\n');
    await processFile('samples/removesynth_seeds.xlsx');
    await processFile('samples/fabcastle_seeds.xlsx');
  }
}

main().catch(console.error);
