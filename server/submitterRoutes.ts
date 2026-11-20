import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';

const router = Router();
const ROOT_DIR = process.cwd();
const SUBMITTER_DIR = path.join(ROOT_DIR, 'startup-submitter');
const CONFIG_PATH = path.join(SUBMITTER_DIR, 'config', 'startupProfile.json');
const DIRECTORIES_PATH = path.join(SUBMITTER_DIR, 'data', 'directories.json');
const PROOFS_DIR = path.join(SUBMITTER_DIR, 'proofs');
const OUTPUT_DIR = path.join(SUBMITTER_DIR, 'output');

// Ensure directories exist
if (!fs.existsSync(PROOFS_DIR)) fs.mkdirSync(PROOFS_DIR, { recursive: true });
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

interface SubmitterRunState {
  status: 'idle' | 'running' | 'completed' | 'stopped' | 'error';
  currentSite: string;
  currentIndex: number;
  totalSites: number;
  submittedCount: number;
  skippedCount: number;
  errorCount: number;
  logs: Array<{ time: string; text: string; level: 'info' | 'success' | 'warn' | 'error' }>;
  latestProof?: string;
}

let activeRun: SubmitterRunState = {
  status: 'idle',
  currentSite: '',
  currentIndex: 0,
  totalSites: 0,
  submittedCount: 0,
  skippedCount: 0,
  errorCount: 0,
  logs: []
};

let activeChildProcess: ChildProcess | null = null;
const sseClients: any[] = [];

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
  activeRun.logs.push({ time, text, level });
  if (activeRun.logs.length > 500) activeRun.logs.shift();
  broadcastSSE('log', { time, text, level });
  broadcastSSE('state', activeRun);
}

// 1. Get Startup Profile
router.get('/profile', (req, res) => {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const profile = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      res.json({ success: true, profile });
    } else {
      res.status(404).json({ success: false, message: 'Profile file not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Save Startup Profile
router.post('/profile', (req, res) => {
  try {
    const updated = req.body;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf8');
    res.json({ success: true, message: 'Profile saved successfully!' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Get Directories List
router.get('/directories', (req, res) => {
  try {
    if (fs.existsSync(DIRECTORIES_PATH)) {
      const directories = JSON.parse(fs.readFileSync(DIRECTORIES_PATH, 'utf8'));
      res.json({ success: true, directories });
    } else {
      res.status(404).json({ success: false, message: 'Directories file not found' });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Get Proofs Gallery
router.get('/proofs', (req, res) => {
  try {
    if (!fs.existsSync(PROOFS_DIR)) {
      return res.json({ success: true, proofs: [] });
    }
    const files = fs.readdirSync(PROOFS_DIR)
      .filter((f) => /\.(png|jpg|jpeg|webp)$/i.test(f))
      .map((f) => {
        const stats = fs.statSync(path.join(PROOFS_DIR, f));
        return {
          filename: f,
          url: `/submitter-proofs/${f}`,
          mtime: stats.mtimeMs,
          size: stats.size,
          site: f.split('_')[0]
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    res.json({ success: true, proofs: files });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 5. Get History & Ledgers
router.get('/history', (req, res) => {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      return res.json({ success: true, ledgers: [] });
    }
    const files = fs.readdirSync(OUTPUT_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const fullPath = path.join(OUTPUT_DIR, f);
        const stats = fs.statSync(fullPath);
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        return {
          filename: f,
          mtime: stats.mtimeMs,
          records: data.length,
          data
        };
      })
      .sort((a, b) => b.mtime - a.mtime);

    res.json({ success: true, ledgers: files });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 6. SSE Real-time Status Stream
router.get('/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);
  res.write(`event: state\ndata: ${JSON.stringify(activeRun)}\n\n`);

  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// 7. Launch Submission Task
router.post('/run', (req, res) => {
  if (activeRun.status === 'running') {
    return res.status(400).json({ success: false, message: 'A submission task is already running!' });
  }

  const { limit, site, type, headless } = req.body;

  const runnerScript = path.join(SUBMITTER_DIR, 'src', 'runner.ts');
  const cliArgs = [runnerScript];

  if (limit) cliArgs.push('--limit', String(limit));
  if (site) cliArgs.push('--site', String(site));
  if (type) cliArgs.push('--type', String(type));
  if (headless) cliArgs.push('--headless');

  activeRun = {
    status: 'running',
    currentSite: site || 'Initializing...',
    currentIndex: 0,
    totalSites: limit || 101,
    submittedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    logs: []
  };

  appendLog(`Initiating submission task: ${cliArgs.join(' ')}`, 'info');

  const tsNodeBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  activeChildProcess = spawn(tsNodeBin, ['ts-node', ...cliArgs], {
    cwd: ROOT_DIR,
    shell: true,
  });

  activeChildProcess.stdout?.on('data', (data) => {
    const lines = data.toString().split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.includes('Processing:')) {
        const match = trimmed.match(/\[(\d+)\/(\d+)\] Processing: (.*)/);
        if (match) {
          activeRun.currentIndex = parseInt(match[1], 10);
          activeRun.totalSites = parseInt(match[2], 10);
          activeRun.currentSite = match[3];
        }
      }

      if (trimmed.includes('STATUS: [SUBMITTED]')) {
        activeRun.submittedCount++;
        appendLog(trimmed, 'success');
      } else if (trimmed.includes('STATUS: [SKIPPED]')) {
        activeRun.skippedCount++;
        appendLog(trimmed, 'warn');
      } else if (trimmed.includes('STATUS: [FAILED]')) {
        activeRun.errorCount++;
        appendLog(trimmed, 'error');
      } else {
        appendLog(trimmed, 'info');
      }
    }
  });

  activeChildProcess.stderr?.on('data', (data) => {
    const errText = data.toString().trim();
    if (errText) appendLog(errText, 'error');
  });

  activeChildProcess.on('close', (code) => {
    activeRun.status = code === 0 ? 'completed' : 'error';
    activeRun.currentSite = 'Completed';
    appendLog(`Submission process exited with code ${code}. Total submitted: ${activeRun.submittedCount}`, code === 0 ? 'success' : 'warn');
    broadcastSSE('state', activeRun);
  });

  res.json({ success: true, message: 'Submission task started successfully!' });
});

// 8. Stop Submission Task
router.post('/stop', (req, res) => {
  if (activeChildProcess && activeRun.status === 'running') {
    activeChildProcess.kill('SIGTERM');
    activeRun.status = 'stopped';
    appendLog('Process halted by user.', 'warn');
    broadcastSSE('state', activeRun);
    res.json({ success: true, message: 'Task terminated' });
  } else {
    res.json({ success: false, message: 'No active task to stop' });
  }
});

export default router;

