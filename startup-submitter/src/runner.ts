import fs from 'fs';
import path from 'path';
import type { DirectoryInfo, StartupProfile, SubmissionResult } from './core/types.ts';
import { createStealthContext } from './core/stealthBrowser.ts';
import { processDirectorySubmission } from './adapters/genericAdapter.ts';

async function main() {
  const args = process.argv.slice(2);

  // 1. Load Startup Profile
  const profilePath = path.resolve(process.cwd(), 'startup-submitter', 'config', 'startupProfile.json');
  if (!fs.existsSync(profilePath)) {
    console.error(`Profile not found at: ${profilePath}`);
    console.error('Please configure your startup profile in startup-submitter/config/startupProfile.json');
    process.exit(1);
  }
  const profile: StartupProfile = JSON.parse(fs.readFileSync(profilePath, 'utf8'));

  // 2. Load Directories
  const dirPath = path.resolve(process.cwd(), 'startup-submitter', 'data', 'directories.json');
  const allDirectories: DirectoryInfo[] = JSON.parse(fs.readFileSync(dirPath, 'utf8'));

  // Parse CLI args
  const limitIdx = args.findIndex((a) => a === '--limit');
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : undefined;

  const siteIdx = args.findIndex((a) => a === '--site');
  const siteFilter = siteIdx !== -1 ? args[siteIdx + 1] : undefined;

  const typeIdx = args.findIndex((a) => a === '--type');
  const typeFilter = typeIdx !== -1 ? args[typeIdx + 1] : undefined;

  const isHeadless = args.includes('--headless') || profile.settings?.headless || false;

  let targets = allDirectories;

  // Filter out Reddit by default unless requested
  if (!siteFilter && !typeFilter) {
    targets = targets.filter((d) => d.type !== 'reddit');
  }

  if (typeFilter) {
    targets = targets.filter((d) => d.type === typeFilter);
  }

  if (siteFilter) {
    targets = targets.filter((d) => d.id === siteFilter || d.name.toLowerCase().includes(siteFilter.toLowerCase()));
  }

  if (limit && limit > 0) {
    targets = targets.slice(0, limit);
  }

  console.log(`\n======================================================`);
  console.log(` 🚀 Automated Startup Backlink Submitter`);
  console.log(`======================================================`);
  console.log(`Startup:       ${profile.startup.name} (${profile.startup.url})`);
  console.log(`Total Targets: ${targets.length} directory websites`);
  console.log(`Mode:          ${isHeadless ? 'Headless' : 'Visible Stealth Browser'}`);
  console.log(`======================================================\n`);

  const proofsDir = path.resolve(process.cwd(), 'startup-submitter', 'proofs');
  const outDir = path.resolve(process.cwd(), 'startup-submitter', 'output');
  fs.mkdirSync(proofsDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });

  const { context, page } = await createStealthContext(isHeadless);
  const results: SubmissionResult[] = [];

  try {
    for (let i = 0; i < targets.length; i++) {
      const dir = targets[i];
      console.log(`[${i + 1}/${targets.length}] Processing: ${dir.name}`);

      const res = await processDirectorySubmission(page, dir, profile, proofsDir);
      results.push(res);

      console.log(`  -> STATUS: [${res.status}] ${res.message}`);

      // Rate limit cooldown between directory websites to protect IP reputation
      if (i < targets.length - 1) {
        const cooldown = profile.settings?.delayBetweenSitesMs || 4000;
        console.log(`  -> Waiting ${cooldown / 1000}s cooldown before next directory...\n`);
        await new Promise((r) => setTimeout(r, cooldown));
      }
    }
  } finally {
    await context.close();
  }

  // Save Results Ledger
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const jsonPath = path.join(outDir, `submissions_${timestamp}.json`);
  const csvPath = path.join(outDir, `submissions_${timestamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf8');

  // Generate CSV
  const csvHeader = 'Directory,Target URL,Status,Message,Proof Screenshot,Timestamp\n';
  const csvRows = results
    .map(
      (r) =>
        `"${r.directoryName}","${r.targetUrl}","${r.status}","${r.message.replace(/"/g, '""')}","${r.proofScreenshot || ''}","${r.timestamp}"`
    )
    .join('\n');
  fs.writeFileSync(csvPath, csvHeader + csvRows, 'utf8');

  console.log(`\n======================================================`);
  console.log(` Submission Run Completed!`);
  console.log(`======================================================`);
  console.table(
    results.map((r) => ({
      Directory: r.directoryName,
      Status: r.status,
      Message: r.message.slice(0, 40) + '...',
    }))
  );

  console.log(`\nSaved Results:`);
  console.log(`- CSV Ledger:  ${csvPath}`);
  console.log(`- JSON Ledger: ${jsonPath}`);
  console.log(`- Proofs Dir:  ${proofsDir}`);
  console.log(`======================================================\n`);
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
