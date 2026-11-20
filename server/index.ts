import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as XLSXModule from 'xlsx';
const XLSX = (XLSXModule as any).default || XLSXModule;
import submitterRouter from './submitterRoutes.ts';

const app = express();
const PORT = process.env.PORT || 5221;
const ROOT_DIR = process.cwd();
const OUTPUT_DIR = path.join(ROOT_DIR, 'output');
const SAMPLES_DIR = path.join(ROOT_DIR, 'samples');
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(PUBLIC_DIR));

// Startup Submitter Mounts
app.use('/submitter-proofs', express.static(path.join(ROOT_DIR, 'startup-submitter', 'proofs')));
app.use('/api/submitter', submitterRouter);

// Page Routes
app.get('/home', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'home.html'));
});

app.get('/keyword-research', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.get('/submitter', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'submitter.html'));
});

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(SAMPLES_DIR)) fs.mkdirSync(SAMPLES_DIR, { recursive: true });
if (!fs.existsSync(PUBLIC_DIR)) fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// In-memory cache for parsed report files to ensure blazing fast navigation
interface ParsedReport {
  filename: string;
  mtime: number;
  rows: any[];
  summary: {
    totalKeywords: number;
    totalVolume: number;
    avgDifficulty: number;
    phraseMatches: number;
    questions: number;
    countries: Record<string, number>;
    tools: Record<string, number>;
  };
}
const reportCache = new Map<string, ParsedReport>();

// Active runner state
interface RunState {
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'error';
  targetFile: string;
  start: number;
  limit?: number;
  batch?: string;
  currentSeedIndex: number;
  totalSeeds: number;
  currentKeyword: string;
  currentCountry: string;
  currentTool: string;
  keywordsFound: number;
  phraseMatches: number;
  questions: number;
  handoffs: number;
  errors: number;
  startTime: number;
  endTime?: number;
  outputFiles?: { xlsx?: string; csv?: string };
  logs: Array<{ time: string; text: string; level: 'info' | 'success' | 'warn' | 'error' }>;
}

let activeRun: RunState = {
  status: 'idle',
  targetFile: '',
  start: 1,
  currentSeedIndex: 0,
  totalSeeds: 0,
  currentKeyword: '',
  currentCountry: '',
  currentTool: '',
  keywordsFound: 0,
  phraseMatches: 0,
  questions: 0,
  handoffs: 0,
  errors: 0,
  startTime: 0,
  logs: []
};

let activeChildProcess: ChildProcess | null = null;
const sseClients: express.Response[] = [];

function broadcastSSE(event: string, data: any) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (let i = sseClients.length - 1; i >= 0; i--) {
    try {
      sseClients[i].write(payload);
    } catch {
      sseClients.splice(i, 1);
    }
  }
}

function appendLog(text: string, level: 'info' | 'success' | 'warn' | 'error' = 'info') {
  const time = new Date().toLocaleTimeString();
  const entry = { time, text, level };
  activeRun.logs.push(entry);
  if (activeRun.logs.length > 1000) activeRun.logs.shift();
  broadcastSSE('log', entry);
}

// -------------------------------------------------------------
// Helper: Parse CSV or XLSX output into structured rows & stats
// -------------------------------------------------------------
function parseReportFile(filePath: string): ParsedReport {
  const filename = path.basename(filePath);
  const stat = fs.statSync(filePath);

  const cached = reportCache.get(filename);
  if (cached && cached.mtime === stat.mtimeMs) {
    return cached;
  }

  let rawRows: any[] = [];
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.csv') {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length > 0) {
      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      for (let i = 1; i < lines.length; i++) {
        // Simple CSV line parser respecting quotes
        const line = lines[i];
        const cols: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let c = 0; c < line.length; c++) {
          const char = line[c];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            cols.push(cur);
            cur = '';
          } else {
            cur += char;
          }
        }
        cols.push(cur);

        const rowObj: any = {};
        for (let h = 0; h < headers.length; h++) {
          rowObj[headers[h]] = (cols[h] ?? '').trim().replace(/^"|"$/g, '');
        }
        rawRows.push(rowObj);
      }
    }
  } else if (ext === '.xlsx') {
    const wb = XLSX.readFile(filePath);
    // Find the detailed keywords sheet if available (e.g. 'All Keywords Detail', 'Keywords Detail', 'Keywords')
    const detailSheetName = wb.SheetNames.find(n => /all keywords|keywords detail|detail|raw/i.test(n)) || wb.SheetNames[0];
    const sheet = wb.Sheets[detailSheetName];
    rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  }

  // Standardize rows
  let totalVolume = 0;
  let kdSum = 0;
  let kdCount = 0;
  let phraseMatches = 0;
  let questions = 0;
  const countries: Record<string, number> = {};
  const tools: Record<string, number> = {};

  const standardizedRows = rawRows.map((r, index) => {
    const keyword = String(r.keyword || r.Keyword || r['Tool / Keyword'] || '').trim();
    let seed = String(r.seed || r.Seed || '').trim();
    if (!seed) seed = String(r.tool || r.Tool || r['Tool / Keyword'] || keyword).trim();
    const tool = String(r.tool || r.Tool || 'General').trim();
    const group = String(r.group || r.Group || '').trim();
    const country = String(r.country || r.Country || 'us').toLowerCase();
    const list = String(r.list || r.List || 'Phrase match').trim();
    
    // Volume
    let vol = parseInt(String(r.volume || r.Volume || '0').replace(/[^0-9]/g, ''), 10);
    if (isNaN(vol)) vol = 0;
    const volText = String(r.volume_text || r.volumeText || r['Volume Text'] || (vol > 0 ? String(vol) : '<100')).trim();

    // KD: support numbers, textual labels ('Easy', 'Medium', 'Hard'), and long-tail inferences
    let rawKdStr = String(r.difficulty_text || r.difficultyText || r['Difficulty Text'] || r.difficulty || r.Difficulty || r.kd || r.KD || '').trim();
    let kd: number | null = null;
    let kdText = rawKdStr;

    const digitMatch = rawKdStr.match(/\b\d{1,3}\b/);
    if (digitMatch) {
      kd = parseInt(digitMatch[0], 10);
      if (kdText === '' || kdText === String(kd)) {
        if (kd < 15) kdText = `Easy (${kd})`;
        else if (kd < 30) kdText = `Medium (${kd})`;
        else kdText = `Hard (${kd})`;
      }
    } else {
      const lower = rawKdStr.toLowerCase();
      if (lower.includes('very easy') || lower.includes('super easy')) {
        kd = 5;
        kdText = 'Very Easy';
      } else if (lower.includes('easy')) {
        kd = 10;
        kdText = 'Easy';
      } else if (lower.includes('med')) {
        kd = 25;
        kdText = 'Medium';
      } else if (lower.includes('very hard') || lower.includes('super hard')) {
        kd = 75;
        kdText = 'Very Hard';
      } else if (lower.includes('hard')) {
        kd = 45;
        kdText = 'Hard';
      } else if (vol >= 1000) {
        kd = 35;
        kdText = 'Hard';
      } else if (vol >= 200) {
        kd = 20;
        kdText = 'Medium';
      } else {
        // Specific long-tail queries (<100 volume) are low-competition rank targets
        kd = 8;
        kdText = 'Easy';
      }
    }

    // CPC
    const cpcRaw = parseFloat(String(r.cpc || r.CPC || '0').replace(/[^0-9.]/g, ''));
    const cpc = isNaN(cpcRaw) ? 0 : cpcRaw;

    totalVolume += vol;
    if (kd !== null) {
      kdSum += kd;
      kdCount++;
    }
    if (list.toLowerCase().includes('question')) questions++;
    else phraseMatches++;

    countries[country] = (countries[country] || 0) + 1;
    if (tool) tools[tool] = (tools[tool] || 0) + 1;

    return {
      id: index + 1,
      keyword,
      seed,
      tool,
      group,
      country,
      list,
      volume: vol,
      volumeText: volText,
      difficulty: kd,
      difficultyText: kdText,
      cpc,
      updated: r.updated || r.Updated || '',
      source: r.source || r.Source || 'ahrefs'
    };
  });

  const parsed: ParsedReport = {
    filename,
    mtime: stat.mtimeMs,
    rows: standardizedRows,
    summary: {
      totalKeywords: standardizedRows.length,
      totalVolume,
      avgDifficulty: kdCount > 0 ? Math.round(kdSum / kdCount) : 0,
      phraseMatches,
      questions,
      countries,
      tools
    }
  };

  reportCache.set(filename, parsed);
  return parsed;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// 1. Status & Active Run
app.get('/api/status', (req, res) => {
  res.json({
    status: activeRun.status,
    activeRun: {
      ...activeRun,
      elapsedMs: activeRun.startTime ? (activeRun.endTime || Date.now()) - activeRun.startTime : 0
    }
  });
});

// 2. Server-Sent Events (SSE) for Real-Time Execution Updates
app.get('/api/run/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  // Send current state
  res.write(`event: state\ndata: ${JSON.stringify(activeRun)}\n\n`);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 3. List Reports
app.get('/api/reports', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ reports: [] });
    }
    const files = fs.readdirSync(OUTPUT_DIR);
    const reports = files
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'))
      .map(f => {
        const fullPath = path.join(OUTPUT_DIR, f);
        const stat = fs.statSync(fullPath);
        return {
          filename: f,
          sizeBytes: stat.size,
          sizeFormatted: stat.size > 1048576 
            ? `${(stat.size / 1048576).toFixed(2)} MB` 
            : `${(stat.size / 1024).toFixed(1)} KB`,
          modifiedAt: stat.mtime.toISOString(),
          ext: path.extname(f).slice(1).toUpperCase()
        };
      })
      .sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());

    res.json({ reports });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Get Report Details with Filters, Search & Pagination
app.get('/api/reports/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(OUTPUT_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const report = parseReportFile(filePath);

    // Apply filtering
    let filtered = report.rows;
    const { search, country, list, minKd, maxKd, minVol, maxVol, tool, sort, order, page = '1', limit = '50' } = req.query;

    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      filtered = filtered.filter(r => 
        r.keyword.toLowerCase().includes(q) || 
        r.seed.toLowerCase().includes(q) || 
        r.tool.toLowerCase().includes(q)
      );
    }

    if (country && typeof country === 'string' && country !== 'all') {
      filtered = filtered.filter(r => r.country.toLowerCase() === country.toLowerCase());
    }

    if (list && typeof list === 'string' && list !== 'all') {
      filtered = filtered.filter(r => r.list.toLowerCase() === list.toLowerCase());
    }

    if (tool && typeof tool === 'string' && tool !== 'all') {
      filtered = filtered.filter(r => r.tool.toLowerCase() === tool.toLowerCase());
    }

    if (minKd !== undefined && minKd !== '') {
      const min = parseInt(String(minKd), 10);
      filtered = filtered.filter(r => r.difficulty !== null && r.difficulty >= min);
    }

    if (maxKd !== undefined && maxKd !== '') {
      const max = parseInt(String(maxKd), 10);
      filtered = filtered.filter(r => r.difficulty !== null && r.difficulty <= max);
    }

    if (minVol !== undefined && minVol !== '') {
      const min = parseInt(String(minVol), 10);
      filtered = filtered.filter(r => r.volume >= min);
    }

    if (maxVol !== undefined && maxVol !== '') {
      const max = parseInt(String(maxVol), 10);
      filtered = filtered.filter(r => r.volume <= max);
    }

    // Sorting
    if (sort && typeof sort === 'string') {
      const isAsc = order === 'asc';
      filtered.sort((a, b) => {
        let valA = a[sort];
        let valB = b[sort];
        if (valA === null || valA === undefined) valA = isAsc ? Infinity : -Infinity;
        if (valB === null || valB === undefined) valB = isAsc ? Infinity : -Infinity;

        if (typeof valA === 'string') {
          return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return isAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
      });
    }

    // Pagination
    const totalFiltered = filtered.length;
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.max(1, parseInt(String(limit), 10) || 50);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedRows = filtered.slice(startIndex, startIndex + limitNum);

    // Split into Phrase Match and Questions for Side-by-Side view
    const phraseMatchList = filtered.filter(r => !r.list.toLowerCase().includes('question'));
    const questionsList = filtered.filter(r => r.list.toLowerCase().includes('question'));

    const phraseMatchRows = phraseMatchList.slice(startIndex, startIndex + limitNum);
    const questionsRows = questionsList.slice(startIndex, startIndex + limitNum);

    const maxSideCount = Math.max(phraseMatchList.length, questionsList.length);
    const splitTotalPages = Math.ceil(maxSideCount / limitNum) || 1;

    // Group by Seed Keyword (seed + country)
    const seedMap = new Map<string, {
      seed: string;
      tool: string;
      group: string;
      country: string;
      phraseMatches: any[];
      questions: any[];
      totalVolume: number;
      kdSum: number;
      kdCount: number;
    }>();

    for (const r of filtered) {
      const key = `${r.seed.toLowerCase().trim()}:::${r.country.toLowerCase().trim()}`;
      let item = seedMap.get(key);
      if (!item) {
        item = {
          seed: r.seed,
          tool: r.tool,
          group: r.group,
          country: r.country,
          phraseMatches: [],
          questions: [],
          totalVolume: 0,
          kdSum: 0,
          kdCount: 0
        };
        seedMap.set(key, item);
      }
      if (r.list.toLowerCase().includes('question')) {
        item.questions.push(r);
      } else {
        item.phraseMatches.push(r);
      }
      item.totalVolume += (r.volume || 0);
      if (r.difficulty !== null && r.difficulty !== undefined) {
        item.kdSum += r.difficulty;
        item.kdCount++;
      }
    }

    const allSeedGroups = Array.from(seedMap.values()).map(g => ({
      seed: g.seed,
      tool: g.tool,
      group: g.group,
      country: g.country,
      totalVolume: g.totalVolume,
      avgKd: g.kdCount > 0 ? Math.round(g.kdSum / g.kdCount) : 0,
      phraseMatches: g.phraseMatches,
      questions: g.questions,
      phraseMatchCount: g.phraseMatches.length,
      questionsCount: g.questions.length
    }));

    // Seed pagination (default 1 seed per view)
    const seedLimitNum = Math.max(1, parseInt(String(req.query.seedLimit || '1'), 10));
    const seedPageNum = Math.max(1, parseInt(String(req.query.seedPage || page || '1'), 10));
    const seedStartIndex = (seedPageNum - 1) * seedLimitNum;
    const paginatedSeedGroups = allSeedGroups.slice(seedStartIndex, seedStartIndex + seedLimitNum);
    const totalSeedPages = Math.ceil(allSeedGroups.length / seedLimitNum) || 1;

    res.json({
      filename: report.filename,
      totalCount: report.rows.length,
      filteredCount: totalFiltered,
      totalSeeds: allSeedGroups.length,
      seedPage: seedPageNum,
      seedLimit: seedLimitNum,
      seedTotalPages: totalSeedPages,
      seedGroups: paginatedSeedGroups,
      allSeedNames: Array.from(new Set(report.rows.map(r => r.seed))).filter(Boolean),
      phraseMatchCount: phraseMatchList.length,
      questionsCount: questionsList.length,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalFiltered / limitNum),
      splitTotalPages,
      summary: report.summary,
      rows: paginatedRows,
      phraseMatchRows,
      questionsRows
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Download File
app.get('/api/reports/:filename/download', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(OUTPUT_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('File not found');
    }
    res.download(filePath, filename);
  } catch (err: any) {
    res.status(500).send(err.message);
  }
});

// 6. Delete File
app.delete('/api/reports/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(OUTPUT_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      reportCache.delete(filename);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Seed Presets
app.get('/api/presets', (req, res) => {
  try {
    if (!fs.existsSync(SAMPLES_DIR)) return res.json({ presets: [] });
    const files = fs.readdirSync(SAMPLES_DIR);
    const presets = files
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.csv'))
      .map(f => {
        const full = path.join(SAMPLES_DIR, f);
        const stat = fs.statSync(full);
        return {
          filename: f,
          path: `samples/${f}`,
          sizeFormatted: `${(stat.size / 1024).toFixed(1)} KB`,
          name: f.replace(/_seeds?\.(xlsx|csv)$/i, '').replace(/_/g, ' ').toUpperCase()
        };
      });
    res.json({ presets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7.2 Upload Custom Excel or CSV Seed Matrix
app.post('/api/upload-seed-file', (req, res) => {
  try {
    const { filename, base64Content } = req.body;
    if (!filename || !base64Content) {
      return res.status(400).json({ error: 'Missing filename or base64Content' });
    }

    const safeName = path.basename(filename).replace(/[^a-zA-Z0-9_.-]/g, '_');
    const buffer = Buffer.from(base64Content, 'base64');
    const dest = path.join(SAMPLES_DIR, safeName);
    fs.writeFileSync(dest, buffer);

    let rowCount = 0;
    let sampleKeywords: string[] = [];
    let sheetName = 'Sheet1';

    try {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      sheetName = wb.SheetNames[0] || 'Sheet1';
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);
      rowCount = rows.length;
      sampleKeywords = rows.slice(0, 5).map(r => String(r.Keyword || r.keyword || r.Seed || r.seed || Object.values(r)[0] || ''));
    } catch {
      // Fallback text line count
      const text = buffer.toString('utf8');
      const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
      rowCount = Math.max(0, lines.length - 1);
      sampleKeywords = lines.slice(1, 6);
    }

    res.json({
      success: true,
      filename: safeName,
      path: `samples/${safeName}`,
      sheetName,
      rowCount,
      sampleKeywords
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 7.5 Competitor Seeds Discovery Endpoint
app.post('/api/competitor-seeds', (req, res) => {
  try {
    const { domain, competitors } = req.body;
    const cleanDomain = String(domain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim();
    const competitorList: string[] = Array.isArray(competitors)
      ? competitors
      : String(competitors || '').split(/[,\n]/).map(s => s.trim()).filter(Boolean);

    const cleanCompetitors = competitorList.map(c => 
      c.toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim()
    ).filter(Boolean);

    const allTokens = [cleanDomain, ...cleanCompetitors].join(' ').toLowerCase();
    const discoveredSeeds: string[] = [];

    // Niche: Proxies / Scraping / IP
    if (/proxy|proxies|brightdata|oxylabs|smartproxy|scraper|ip\b|vpn/i.test(allTokens)) {
      discoveredSeeds.push(
        'residential proxies',
        'buy proxies',
        'rotating residential proxies',
        'datacenter proxies',
        'mobile 4g proxies',
        'best proxy provider',
        'scrape amazon proxies',
        'serp proxy api',
        'web scraping proxies',
        'cheap private proxies',
        'reverse proxy service',
        'how to rotate ip address',
        'sneaker proxies for nike'
      );
    }

    // Niche: Metadata / AI Watermark / SynthID / Image / Audio
    if (/synth|metadata|watermark|exif|c2pa|cleaner|photo|image|audio|video|strip/i.test(allTokens)) {
      discoveredSeeds.push(
        'remove synthid',
        'synthid remover',
        'ai watermark remover',
        'remove c2pa metadata',
        'clean photo metadata',
        'photoshop metadata cleaner',
        'anonymous photo cleaner',
        'remove synthid from audio',
        'remove synthid from video',
        'how to remove synthid watermark',
        'does photoshop strip metadata',
        'free metadata remover online',
        'exif data cleaner tool'
      );
    }

    // Niche: Audio / Converter / Lyrics / Video
    if (/lyric|song|audio|mp3|mp4|converter|download|haul|vid/i.test(allTokens)) {
      discoveredSeeds.push(
        'mp4 to mp3 converter',
        'extract audio from video',
        'youtube audio downloader',
        'clean id3 tags',
        'convert wav to mp3',
        'lyrics to song generator',
        'download youtube transcript',
        'best free mp3 converter'
      );
    }

    // Niche: Height / Calculator / Uptime / Status Tools
    if (/height|calculate|predictor|down|status|uptime/i.test(allTokens)) {
      discoveredSeeds.push(
        'height comparison tool',
        'celebrity height chart',
        'height calculator',
        'is it down right now',
        'website uptime checker'
      );
    }

    // Generic Competitor & Domain Modifiers
    const wordsFromDomains = [cleanDomain, ...cleanCompetitors]
      .map(d => d.split('.')[0].replace(/[^a-z0-9]/g, ' '))
      .join(' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !['com', 'org', 'net', 'io', 'ai', 'app', 'www', 'https', 'http'].includes(w));

    wordsFromDomains.forEach(w => {
      discoveredSeeds.push(`${w} alternatives`, `best ${w} tool`, `free ${w} online`, `how to use ${w}`);
    });

    const uniqueSeeds = Array.from(new Set(discoveredSeeds));

    res.json({
      domain: cleanDomain,
      competitors: cleanCompetitors,
      count: uniqueSeeds.length,
      seeds: uniqueSeeds
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Launch Research Run
app.post('/api/run', (req, res) => {
  if (activeRun.status === 'running') {
    return res.status(400).json({ error: 'A research task is already running!' });
  }

  const { preset, domain, seeds, competitors, countries, start = 1, limit, batch } = req.body;
  const startOffset = parseInt(String(start), 10) || 1;

  let scriptToRun = 'scripts/runRemoveSynthAndFabCastle.ts';
  let targetPreset = preset || 'fabcastle';
  let scriptArgs: string[] = [];

  // If custom seeds or direct seeds are provided:
  let customSeedsList: string[] = [];
  if (Array.isArray(seeds)) {
    customSeedsList = seeds.map(s => String(s).trim()).filter(Boolean);
  } else if (typeof seeds === 'string' && seeds.trim()) {
    customSeedsList = seeds.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
  }

  if (customSeedsList.length > 0) {
    const rawDomain = String(domain || 'custom_campaign').trim();
    const safeDomain = rawDomain.replace(/^https?:\/\//, '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'custom_campaign';
    targetPreset = safeDomain;

    const targetCountries = (Array.isArray(countries) && countries.length > 0)
      ? countries
      : ['us'];

    // Generate CSV in samples/
    const csvLines = ['Tool,Group,Batch,Country,Keyword'];
    for (const seed of customSeedsList) {
      for (const country of targetCountries) {
        csvLines.push(`"${safeDomain}","Direct Seeds","1","${country}","${seed.replace(/"/g, '""')}"`);
      }
    }

    const customCsvPath = path.join(SAMPLES_DIR, `${safeDomain}_seeds.csv`);
    fs.writeFileSync(customCsvPath, csvLines.join('\n'), 'utf8');

    scriptToRun = 'scripts/runBatch.ts';
    scriptArgs = [
      customCsvPath,
      `--start=${startOffset}`
    ];
    if (limit) scriptArgs.push(`--limit=${limit}`);
    if (batch) scriptArgs.push(`--batch=${batch}`);
  } else {
    // Preset chosen
    const candidateCsv = path.join(SAMPLES_DIR, `${targetPreset}_seeds.csv`);
    const candidateXlsx = path.join(SAMPLES_DIR, `${targetPreset}_seeds.xlsx`);
    const candidateDirect = path.join(SAMPLES_DIR, targetPreset);

    if (fs.existsSync(candidateDirect)) {
      scriptToRun = 'scripts/runBatch.ts';
      scriptArgs = [candidateDirect, `--start=${startOffset}`];
    } else if (fs.existsSync(candidateXlsx)) {
      scriptToRun = 'scripts/runBatch.ts';
      scriptArgs = [candidateXlsx, `--start=${startOffset}`];
    } else if (fs.existsSync(candidateCsv)) {
      scriptToRun = 'scripts/runBatch.ts';
      scriptArgs = [candidateCsv, `--start=${startOffset}`];
    } else {
      scriptArgs = [
        targetPreset,
        `--start=${startOffset}`
      ];
    }
    if (limit) scriptArgs.push(`--limit=${limit}`);
    if (batch) scriptArgs.push(`--batch=${batch}`);
  }

  activeRun = {
    status: 'running',
    targetFile: targetPreset,
    start: startOffset,
    limit: limit ? parseInt(String(limit), 10) : undefined,
    batch: batch ? String(batch) : undefined,
    currentSeedIndex: 0,
    totalSeeds: 0,
    currentKeyword: '',
    currentCountry: '',
    currentTool: '',
    keywordsFound: 0,
    phraseMatches: 0,
    questions: 0,
    handoffs: 0,
    errors: 0,
    startTime: Date.now(),
    logs: []
  };

  appendLog(`Initiating Keyword Research Campaign for "${targetPreset}" starting from seed #${startOffset}...`, 'info');
  broadcastSSE('state', activeRun);

  const child = spawn('npx', ['ts-node', scriptToRun, ...scriptArgs], {
    cwd: ROOT_DIR,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  activeChildProcess = child;

  const parseLogLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Detect seed progress: [826/2075] Querying "xxx" (Country) [Tool: YYY]...
    const progressMatch = trimmed.match(/\[(\d+)\/(\d+)\]\s+Querying\s+"([^"]+)"\s+\(([^)]+)\)\s+\[Tool:\s*([^\]]+)\]/i);
    if (progressMatch) {
      activeRun.currentSeedIndex = parseInt(progressMatch[1], 10);
      activeRun.totalSeeds = parseInt(progressMatch[2], 10);
      activeRun.currentKeyword = progressMatch[3];
      activeRun.currentCountry = progressMatch[4];
      activeRun.currentTool = progressMatch[5];
      appendLog(`[${activeRun.currentSeedIndex}/${activeRun.totalSeeds}] ${activeRun.currentKeyword} (${activeRun.currentCountry}) - ${activeRun.currentTool}`, 'info');
      broadcastSSE('state', activeRun);
      return;
    }

    // Detect OK: 40 keywords found (20 Phrase Match, 20 Questions)
    const okMatch = trimmed.match(/OK:\s*(\d+)\s+keywords found\s*\((\d+)\s+Phrase Match,\s*(\d+)\s+Questions\)/i);
    if (okMatch) {
      const count = parseInt(okMatch[1], 10);
      const pm = parseInt(okMatch[2], 10);
      const q = parseInt(okMatch[3], 10);
      activeRun.keywordsFound += count;
      activeRun.phraseMatches += pm;
      activeRun.questions += q;
      appendLog(`  -> Found ${count} keywords (${pm} Phrase Match, ${q} Questions)`, 'success');
      broadcastSSE('state', activeRun);
      return;
    }

    // Detect Handoff: human-check
    if (trimmed.includes('Handoff:')) {
      activeRun.handoffs++;
      appendLog(`  -> ${trimmed}`, 'warn');
      broadcastSSE('state', activeRun);
      return;
    }

    // Detect Error
    if (trimmed.includes('Error processing') || trimmed.includes('Failed:')) {
      activeRun.errors++;
      appendLog(`  -> ${trimmed}`, 'error');
      broadcastSSE('state', activeRun);
      return;
    }

    // Detect output file completed
    const fileMatch = trimmed.match(/- (Excel|CSV):\s*file:\/\/\/(.+)/i);
    if (fileMatch) {
      const type = fileMatch[1].toLowerCase();
      const p = fileMatch[2];
      if (!activeRun.outputFiles) activeRun.outputFiles = {};
      if (type === 'excel') activeRun.outputFiles.xlsx = path.basename(p);
      if (type === 'csv') activeRun.outputFiles.csv = path.basename(p);
      appendLog(`Output saved: ${path.basename(p)}`, 'success');
      broadcastSSE('state', activeRun);
      return;
    }

    appendLog(trimmed, 'info');
  };

  child.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach(parseLogLine);
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    lines.forEach((l: string) => parseLogLine(l));
  });

  child.on('close', (code) => {
    activeRun.endTime = Date.now();
    activeRun.status = code === 0 ? 'completed' : 'stopped';
    activeChildProcess = null;
    appendLog(`Task finished with exit code ${code}. Total keywords found: ${activeRun.keywordsFound}`, code === 0 ? 'success' : 'warn');
    broadcastSSE('state', activeRun);
  });

  res.json({ success: true, message: 'Research task launched successfully' });
});

// 9. Stop Research Run
app.post('/api/run/stop', (req, res) => {
  if (activeChildProcess && activeRun.status === 'running') {
    activeChildProcess.kill('SIGTERM');
    activeRun.status = 'stopped';
    activeRun.endTime = Date.now();
    appendLog('Execution terminated by user.', 'warn');
    broadcastSSE('state', activeRun);
    res.json({ success: true, message: 'Task stopped' });
  } else {
    res.json({ success: false, message: 'No active task running' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` 🚀 Proxy Keywords Studio Server running!`);
  console.log(` Web UI:   http://localhost:${PORT}`);
  console.log(` API Root: http://localhost:${PORT}/api/reports`);
  console.log(`======================================================\n`);
});
