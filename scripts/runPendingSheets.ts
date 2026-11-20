// scripts/runPendingSheets.ts

import fs from 'fs';
import path from 'path';
import * as XLSXModule from 'xlsx';
const XLSX = (XLSXModule as any).default || XLSXModule;
import { cloakedAhrefsGenerator } from '../src/adapters/cloakAhrefsGenerator.ts';
import { countryFor, type Country, type KeywordRow, COUNTRIES } from '../src/lib/keywords.ts';
import { fromGrid, toCsv, toXlsx } from '../src/lib/sheet.ts';

async function processFile(filePath: string) {
  const resolvedInput = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`File not found: ${resolvedInput}`);
    return;
  }

  console.log(`\n======================================================`);
  console.log(` Processing Sheet: ${path.basename(resolvedInput)}`);
  console.log(`======================================================`);

  const wb = XLSX.readFile(resolvedInput);
  const sheetName = wb.SheetNames.includes('Seed keywords') ? 'Seed keywords' : wb.SheetNames[0]!;
  const grid = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[sheetName]!, { header: 1, raw: false, defval: '' })
    .map((r) => r.map((c) => String(c ?? '')));

  const parseResult = fromGrid(grid);
  const targetSeeds = parseResult.rows;

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
      // Non-fatal
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

  console.log(`\nCompleted ${path.basename(resolvedInput)}: ${allRows.length} keywords saved to:`);
  console.log(`- Excel: file:///${xlsxPath.replace(/\\/g, '/')}`);
  console.log(`- CSV:   file:///${csvPath.replace(/\\/g, '/')}\n`);
}

async function main() {
  await processFile('samples/isitupordown_seeds.xlsx');
  await processFile('samples/checkmyheight_seeds.xlsx');
  console.log('All pending sheets (isitupordown & checkmyheight) completed successfully!');
}

main().catch(console.error);
