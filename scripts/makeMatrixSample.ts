// scripts/makeMatrixSample.ts
import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';

const headers = [
  '#',
  'Tool',
  'Group',
  'Batch',
  'India (en (+hi))',
  'USA (en)',
  'Indonesia (id)',
  'Brazil (pt)',
  'Mexico (es)',
  'Philippines (en / tl)',
  'Vietnam (vi)',
  'Turkey (tr)',
  'Bangladesh / Pakistan (en (bn/ur))',
  'Egypt / Saudi Arabia (ar)',
];

const data = [
  [
    '1',
    'MP4 to MP3',
    'A. Converters',
    '1',
    'mp4 to mp3',
    'mp4 to mp3',
    'mp4 ke mp3',
    'converter mp4 para mp3',
    'convertir mp4 a mp3',
    'mp4 to mp3',
    'chuyển mp4 sang mp3',
    'mp4 mp3 dönüştürme',
    'mp4 to mp3',
    'تحويل mp4 إلى mp3',
  ],
  [
    '2',
    'Video to MP3 / Extract audio',
    'A. Converters',
    '1',
    'video to mp3 | extract audio from video',
    'video to mp3 | extract audio from video',
    'video ke mp3',
    'converter vídeo para mp3',
    'convertir video a mp3',
    'video to mp3 | extract audio from video',
    'chuyển video sang mp3',
    'videoyu mp3 yapma',
    'video to mp3 | extract audio from video',
    'تحويل الفيديو إلى mp3',
  ],
  [
    '11',
    'MP4 to GIF',
    'B. GIF tools',
    '1',
    'mp4 to gif',
    'mp4 to gif',
    'mp4 ke gif',
    'converter mp4 para gif',
    'convertir mp4 a gif',
    'mp4 to gif',
    'chuyển mp4 sang gif',
    'mp4 gif yapma',
    'mp4 to gif',
    'تحويل mp4 إلى gif',
  ],
];

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
XLSX.utils.book_append_sheet(wb, ws, 'Tools Matrix');

const outPath = path.resolve(process.cwd(), 'samples', 'matrix_sample.xlsx');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
XLSX.writeFile(wb, outPath);

console.log('Created matrix sample at:', outPath);
