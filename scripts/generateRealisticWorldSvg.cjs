const fs = require('fs');
const d3 = require('d3-geo');

const ISO_NUM_TO_ALPHA2 = {
  '840': { code: 'us', name: 'United States', flag: '🇺🇸', label: 'United States' },
  '124': { code: 'ca', name: 'Canada', flag: '🇨🇦', label: 'Canada' },
  '484': { code: 'mx', name: 'Mexico', flag: '🇲🇽', label: 'Mexico' },
  '076': { code: 'br', name: 'Brazil', flag: '🇧🇷', label: 'Brazil' },
  '032': { code: 'ar', name: 'Argentina', flag: '🇦🇷', label: 'Argentina' },
  '170': { code: 'co', name: 'Colombia', flag: '🇨🇴', label: 'Colombia' },
  '152': { code: 'cl', name: 'Chile', flag: '🇨🇱', label: '' },
  '826': { code: 'gb', name: 'United Kingdom', flag: '🇬🇧', label: 'UK' },
  '276': { code: 'de', name: 'Germany', flag: '🇩🇪', label: 'Germany' },
  '250': { code: 'fr', name: 'France', flag: '🇫🇷', label: 'France' },
  '380': { code: 'it', name: 'Italy', flag: '🇮🇹', label: 'Italy' },
  '724': { code: 'es', name: 'Spain', flag: '🇪🇸', label: 'Spain' },
  '528': { code: 'nl', name: 'Netherlands', flag: '🇳🇱', label: '' },
  '752': { code: 'se', name: 'Sweden', flag: '🇸🇪', label: 'Sweden' },
  '578': { code: 'no', name: 'Norway', flag: '🇳🇴', label: 'Norway' },
  '246': { code: 'fi', name: 'Finland', flag: '🇫🇮', label: '' },
  '616': { code: 'pl', name: 'Poland', flag: '🇵🇱', label: 'Poland' },
  '756': { code: 'ch', name: 'Switzerland', flag: '🇨🇭', label: '' },
  '040': { code: 'at', name: 'Austria', flag: '🇦🇹', label: '' },
  '056': { code: 'be', name: 'Belgium', flag: '🇧🇪', label: '' },
  '372': { code: 'ie', name: 'Ireland', flag: '🇮🇪', label: '' },
  '620': { code: 'pt', name: 'Portugal', flag: '🇵🇹', label: '' },
  '643': { code: 'ru', name: 'Russia', flag: '🇷🇺', label: 'Russia' },
  '792': { code: 'tr', name: 'Turkey', flag: '🇹🇷', label: 'Turkey' },
  '804': { code: 'ua', name: 'Ukraine', flag: '🇺🇦', label: 'Ukraine' },
  '356': { code: 'in', name: 'India', flag: '🇮🇳', label: 'India' },
  '156': { code: 'cn', name: 'China', flag: '🇨🇳', label: 'China' },
  '392': { code: 'jp', name: 'Japan', flag: '🇯🇵', label: 'Japan' },
  '410': { code: 'kr', name: 'South Korea', flag: '🇰🇷', label: 'S. Korea' },
  '360': { code: 'id', name: 'Indonesia', flag: '🇮🇩', label: 'Indonesia' },
  '036': { code: 'au', name: 'Australia', flag: '🇦🇺', label: 'Australia' },
  '554': { code: 'nz', name: 'New Zealand', flag: '🇳🇿', label: 'NZ' },
  '682': { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', label: 'Saudi Arabia' },
  '784': { code: 'ae', name: 'United Arab Emirates', flag: '🇦🇪', label: 'UAE' },
  '818': { code: 'eg', name: 'Egypt', flag: '🇪🇬', label: 'Egypt' },
  '710': { code: 'za', name: 'South Africa', flag: '🇿🇦', label: 'South Africa' },
  '566': { code: 'ng', name: 'Nigeria', flag: '🇳🇬', label: 'Nigeria' },
  '702': { code: 'sg', name: 'Singapore', flag: '🇸🇬', label: '' },
  '458': { code: 'my', name: 'Malaysia', flag: '🇲🇾', label: 'Malaysia' },
  '764': { code: 'th', name: 'Thailand', flag: '🇹🇭', label: 'Thailand' },
  '608': { code: 'ph', name: 'Philippines', flag: '🇵🇭', label: 'Philippines' },
  '704': { code: 'vn', name: 'Vietnam', flag: '🇻🇳', label: 'Vietnam' },
  '586': { code: 'pk', name: 'Pakistan', flag: '🇵🇰', label: 'Pakistan' },
  '050': { code: 'bd', name: 'Bangladesh', flag: '🇧🇩', label: '' },
  '376': { code: 'il', name: 'Israel', flag: '🇮🇱', label: '' },
  '404': { code: 'ke', name: 'Kenya', flag: '🇰🇪', label: 'Kenya' },
  '504': { code: 'ma', name: 'Morocco', flag: '🇲🇦', label: 'Morocco' },
  '012': { code: 'dz', name: 'Algeria', flag: '🇩🇿', label: 'Algeria' },
  '231': { code: 'et', name: 'Ethiopia', flag: '🇪🇹', label: 'Ethiopia' },
  '398': { code: 'kz', name: 'Kazakhstan', flag: '🇰🇿', label: 'Kazakhstan' }
};

const geo = JSON.parse(fs.readFileSync('countries-geo.json', 'utf8'));

// Filter out Antarctica
const countries = geo.features.filter(f => f.id !== '010' && f.properties.name !== 'Antarctica');

// Natural Earth projection fitted to 1000 x 520
const projection = d3.geoNaturalEarth1().fitExtent([[15, 15], [985, 505]], { type: 'FeatureCollection', features: countries });
const pathGenerator = d3.geoPath().projection(projection);

let pathSvg = '';
let labelSvg = '';
const pinCoords = {};

// Manual custom label offsets for optimal visual balance
const LABEL_OVERRIDES = {
  us: { x: 230, y: 175 },
  ca: { x: 235, y: 105 },
  mx: { x: 215, y: 240 },
  br: { x: 360, y: 340 },
  ar: { x: 330, y: 430 },
  co: { x: 285, y: 285 },
  gb: { x: 485, y: 135 },
  fr: { x: 495, y: 175 },
  de: { x: 520, y: 155 },
  es: { x: 475, y: 200 },
  it: { x: 530, y: 195 },
  ru: { x: 690, y: 110 },
  in: { x: 695, y: 245 },
  cn: { x: 765, y: 205 },
  jp: { x: 875, y: 190 },
  au: { x: 845, y: 395 },
  nz: { x: 940, y: 440 },
  sa: { x: 605, y: 240 },
  eg: { x: 575, y: 230 },
  za: { x: 560, y: 410 },
  id: { x: 805, y: 315 },
  se: { x: 530, y: 105 },
  no: { x: 505, y: 95 },
  pl: { x: 550, y: 145 },
  tr: { x: 585, y: 190 }
};

countries.forEach(feature => {
  const numId = String(feature.id).padStart(3, '0');
  const d = pathGenerator(feature);
  if (!d) return;

  const info = ISO_NUM_TO_ALPHA2[numId] || ISO_NUM_TO_ALPHA2[String(parseInt(numId, 10))] || null;
  const code = info ? info.code : `c${numId}`;
  const name = info ? info.name : (feature.properties.name || `Country ${numId}`);
  const flag = info ? info.flag : '🌐';

  // SVG Path
  pathSvg += `  <path class="map-country" id="map-c-${code}" data-code="${code}" data-name="${name.replace(/"/g, '&quot;')}" data-flag="${flag}" d="${d}" />\n`;

  // Compute Centroid for Pin & Label
  const centroid = pathGenerator.centroid(feature);
  if (centroid && !isNaN(centroid[0]) && !isNaN(centroid[1])) {
    const cx = Math.round(centroid[0]);
    const cy = Math.round(centroid[1]);
    
    // Save pin coords
    if (info && info.code) {
      const pinPos = LABEL_OVERRIDES[info.code] || { x: cx, y: cy };
      pinCoords[info.code] = { x: pinPos.x, y: pinPos.y };
    }

    // Add Label if prominent
    if (info && info.label) {
      const pos = LABEL_OVERRIDES[info.code] || { x: cx, y: cy };
      const fontSize = ['us', 'ru', 'cn', 'ca', 'br', 'au', 'in'].includes(info.code) ? '10px' : '8.5px';
      labelSvg += `  <text class="map-country-name-label" data-code="${info.code}" x="${pos.x}" y="${pos.y}" font-size="${fontSize}">${info.label}</text>\n`;
    }
  }
});

fs.writeFileSync('generated_map_paths.svg', pathSvg);
fs.writeFileSync('generated_map_labels.svg', labelSvg);
fs.writeFileSync('generated_pin_coords.json', JSON.stringify(pinCoords, null, 2));

console.log('Successfully generated realistic map SVG elements and coordinates!');
