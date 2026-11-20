// scripts/prepareTestYourSetupSheet.ts
import * as XLSXModule from 'xlsx';
const XLSX = (XLSXModule as any).default || XLSXModule;
import path from 'path';
import fs from 'fs';

const englishKeywords = [
  'packet loss test',
  'jitter test',
  'sound level meter',
  'decibel meter',
  'monitor flickering',
  'controller test',
  'stick drift test',
  'ps5 controller test',
  'mouse dpi test',
  'mouse polling rate test',
  'mouse double click test',
  'keyboard latency test',
  'keyboard chatter test',
  'nkro test',
  'headphone test',
  'left right audio test',
  'speaker test',
  'hacker typer',
  'fake update screen',
  'fake windows update',
  'fake blue screen of death',
  'broken screen prank',
  'dvd screensaver',
  'flip clock',
  'matrix screensaver',
  'no signal screen',
  'tv static screen',
  'virtual fireplace',
  'ring light online',
  'zoom lighting',
  'red screen',
  'green screen',
  'color screen',
  'look busy screen',
  'fake coding screen',
  'touchpad test',
];

const englishCountries = [
  { code: 'us', name: 'United States' },
  { code: 'gb', name: 'United Kingdom' },
  { code: 'ca', name: 'Canada' },
  { code: 'in', name: 'India' },
  { code: 'au', name: 'Australia' },
  { code: 'ph', name: 'Philippines' },
];

const localizedItems: Array<{ country: string; seed: string }> = [
  // BRAZIL
  { country: 'br', seed: 'teste de teclado' },
  { country: 'br', seed: 'teste de microfone' },
  { country: 'br', seed: 'testar controle' },
  { country: 'br', seed: 'tela branca' },

  // GERMANY
  { country: 'de', seed: 'mikrofon test' },
  { country: 'de', seed: 'webcam testen' },
  { country: 'de', seed: 'tastatur test' },

  // JAPAN
  { country: 'jp', seed: 'キーボードテスト' },
  { country: 'jp', seed: 'マイクテスト' },

  // SOUTH KOREA
  { country: 'kr', seed: '키보드 테스트' },

  // FRANCE
  { country: 'fr', seed: 'test micro' },
  { country: 'fr', seed: 'test clavier' },

  // ITALY
  { country: 'it', seed: 'test webcam' },
  { country: 'it', seed: 'test microfono' },

  // POLAND
  { country: 'pl', seed: 'test mikrofonu' },
  { country: 'pl', seed: 'test kamery online' },

  // TURKEY
  { country: 'tr', seed: 'klavye testi' },
  { country: 'tr', seed: 'mikrofon test' },
  { country: 'tr', seed: 'ölü piksel testi' },
  { country: 'tr', seed: 'beyaz ekran' },

  // VIETNAM
  { country: 'vi', seed: 'test keyboard' },
  { country: 'vi', seed: 'điểm chết màn hình' },

  // INDONESIA
  { country: 'id', seed: 'cek keyboard' },
  { country: 'id', seed: 'cek mic' },
  { country: 'id', seed: 'test dead pixel' },

  // THAILAND
  { country: 'th', seed: 'dead pixel test' },
  { country: 'th', seed: 'keyboard test' },

  // RUSSIA
  { country: 'ru', seed: 'проверка микрофона' },
  { country: 'ru', seed: 'тест клавиатуры' },
  { country: 'ru', seed: 'проверка веб камеры' },

  // TAIWAN
  { country: 'tw', seed: '鍵盤測試' },
  { country: 'tw', seed: '手把測試' },
];

function getGroup(seed: string): string {
  const s = seed.toLowerCase();
  if (/mouse|dpi|polling|click/.test(s)) return 'Mouse Tests';
  if (/keyboard|teclado|tastatur|klavye|chatter|latency|nkro|鍵盤|키보드/.test(s)) return 'Keyboard Tests';
  if (/controller|stick drift|ps5|controle|手把/.test(s)) return 'Controller Tests';
  if (/mic|sound|decibel|headphone|audio|speaker|microfone|microfono|mikrofon|микрофон/.test(s)) return 'Audio Tests';
  if (/webcam|kamera|камер/.test(s)) return 'Camera Tests';
  if (/screen|flickering|prank|screensaver|tv static|fireplace|light|lighting|tela|ekran|dead pixel|màn hình|piksel/.test(s)) return 'Screen & Prank Tools';
  if (/loss|jitter/.test(s)) return 'Network Tests';
  return 'General Setup';
}

const rows: Array<{ tool: string; group: string; batch: string; country: string; seed: string }> = [];

// 1. English seeds across US, GB, CA, IN, AU, PH
for (const kw of englishKeywords) {
  const toolName = kw.charAt(0).toUpperCase() + kw.slice(1);
  const group = getGroup(kw);
  for (const c of englishCountries) {
    rows.push({
      tool: toolName,
      group,
      batch: '1',
      country: c.code,
      seed: kw,
    });
  }
}

// 2. Localized seeds
for (const item of localizedItems) {
  const toolName = item.seed.charAt(0).toUpperCase() + item.seed.slice(1);
  const group = getGroup(item.seed);
  rows.push({
    tool: toolName,
    group,
    batch: '1',
    country: item.country,
    seed: item.seed,
  });
}

console.log(`Prepared ${rows.length} seeds for TestYourSetup:`);
console.log(`- English seeds (36 tools x 6 countries): ${englishKeywords.length * englishCountries.length}`);
console.log(`- Localized seeds (13 countries): ${localizedItems.length}`);
console.log(`- Total: ${rows.length}`);

// Generate Sheet
const sheetData = [
  ['Tool', 'Group', 'Batch', 'Country', 'Seed'],
  ...rows.map(r => [r.tool, r.group, r.batch, r.country, r.seed]),
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet(sheetData);
ws['!cols'] = [{ wch: 30 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 35 }];
XLSX.utils.book_append_sheet(wb, ws, 'TestYourSetup Seeds');

const outPath = path.resolve(process.cwd(), 'samples', 'TestYourSetup_seeds.xlsx');
XLSX.writeFile(wb, outPath);

console.log('Saved TestYourSetup seed sheet to:', outPath);
