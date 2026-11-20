// scripts/runBatch.ts

import fs from 'fs';
import path from 'path';
import * as XLSXModule from 'xlsx';
const XLSX = (XLSXModule as any).default || XLSXModule;
import { cloakedAhrefsGenerator } from '../src/adapters/cloakAhrefsGenerator.ts';
import { countryFor, type Country, type KeywordRow, COUNTRIES } from '../src/lib/keywords.ts';
import { fromGrid, parseCsvText, toCsv, toXlsx } from '../src/lib/sheet.ts';

async function main() {
  const args = process.argv.slice(2);
  let inputFile = args.find((a) => !a.startsWith('--')) || 'D:\\Nitin\\lyricstosong\\VidHaul tool keyword research.xlsx';
  const resolvedInput = path.resolve(process.cwd(), inputFile);

  const batchArgIdx = args.findIndex((a) => a === '--batch');
  const batchFilter = batchArgIdx !== -1 ? args[batchArgIdx + 1] : undefined;

  const limitArgIdx = args.findIndex((a) => a === '--limit');
  const limitFilter = limitArgIdx !== -1 ? parseInt(args[limitArgIdx + 1], 10) : undefined;

  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: File not found: ${resolvedInput}`);
    console.log('Usage: npx ts-node scripts/runBatch.ts [path/to/sheet.xlsx] [--batch 1] [--limit 10]');
    process.exit(1);
  }

  console.log(`\n======================================================`);
  console.log(` Ahrefs Batch Keyword Researcher (CloakBrowser)`);
  console.log(`======================================================`);
  console.log(`Input Sheet: ${resolvedInput}`);
  if (batchFilter) console.log(`Batch Filter: Batch ${batchFilter}`);
  if (limitFilter) console.log(`Limit:        ${limitFilter} seeds`);
  console.log(`======================================================\n`);

  let grid: string[][] = [];
  if (/\.(xlsx|xlsm|xls|ods)$/i.test(resolvedInput)) {
    const wb = XLSX.readFile(resolvedInput);
    const sheetName = wb.SheetNames.includes('Seed keywords') ? 'Seed keywords' : wb.SheetNames[0]!;
    console.log(`Reading worksheet: "${sheetName}"...`);
    grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName]!, { header: 1, raw: false, defval: '' })
      .map((r) => r.map((c) => String(c ?? '')));
  } else {
    const content = fs.readFileSync(resolvedInput, 'utf8');
    grid = parseCsvText(content);
  }

  const parseResult = fromGrid(grid);
  if (!parseResult.rows.length) {
    console.error('Error: No seed keywords found in the input file.');
    if (parseResult.problems.length) {
      console.error('Issues detected:', parseResult.problems.join('\n'));
    }
    process.exit(1);
  }

  const startArgIdx = args.findIndex((a) => a === '--start' || a.startsWith('--start='));
  let startFilter: number | undefined;
  if (startArgIdx !== -1) {
    const val = args[startArgIdx].includes('=') ? args[startArgIdx].split('=')[1] : args[startArgIdx + 1];
    startFilter = parseInt(val, 10);
  }

  let targetSeeds = parseResult.rows;

  if (startFilter && startFilter > 1) {
    const startIdx = startFilter - 1;
    targetSeeds = targetSeeds.slice(startIdx);
    console.log(`Starting from seed #${startFilter}: ${targetSeeds.length} seeds remaining`);
  }

  if (batchFilter) {
    targetSeeds = targetSeeds.filter((r) => String(r.batch) === String(batchFilter));
    console.log(`Filtered to Batch ${batchFilter}: ${targetSeeds.length} seeds`);
  }

  if (limitFilter && limitFilter > 0) {
    targetSeeds = targetSeeds.slice(0, limitFilter);
    console.log(`Limited to first ${targetSeeds.length} seeds`);
  }

  console.log(`Detected Format: ${parseResult.shape.toUpperCase()}`);
  if (parseResult.readAs) console.log(`Inference:       ${parseResult.readAs}`);
  console.log(`Total Seeds to Process: ${targetSeeds.length}`);
  console.log(`Countries:       ${parseResult.countries.join(', ') || 'default (India)'}\n`);

  const allRows: KeywordRow[] = [];
  const defaultCountry: Country = COUNTRIES.find((c) => c.code === 'in') || { code: 'in', name: 'India', hl: 'en' };

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
      // Non-fatal checkpoint save
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

    // Checkpoint save every 2 lookups or on last
    if ((i + 1) % 2 === 0 || i === targetSeeds.length - 1) {
      saveCheckpoint();
    }
  }

  saveCheckpoint();

  console.log(`\n======================================================`);
  console.log(` Batch Run Completed!`);
  console.log(`======================================================`);
  console.log(`Total Keyword Rows: ${allRows.length}`);
  console.log(`Unique Keywords:    ${new Set(allRows.map((r) => r.keyword.toLowerCase())).size}`);
  console.log(`- Excel: file:///${xlsxPath.replace(/\\/g, '/')}`);
  console.log(`- CSV:   file:///${csvPath.replace(/\\/g, '/')}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal batch runner error:', err);
  process.exit(1);
});
