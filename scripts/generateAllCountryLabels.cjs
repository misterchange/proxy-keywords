const fs = require('fs');
const d3 = require('d3-geo');

const ISO_NUM_TO_ALPHA2 = {
  '840': { code: 'us', name: 'United States', flag: '🇺🇸', label: 'United States', tier: 1 },
  '124': { code: 'ca', name: 'Canada', flag: '🇨🇦', label: 'Canada', tier: 1 },
  '484': { code: 'mx', name: 'Mexico', flag: '🇲🇽', label: 'Mexico', tier: 1 },
  '076': { code: 'br', name: 'Brazil', flag: '🇧🇷', label: 'Brazil', tier: 1 },
  '032': { code: 'ar', name: 'Argentina', flag: '🇦🇷', label: 'Argentina', tier: 1 },
  '170': { code: 'co', name: 'Colombia', flag: '🇨🇴', label: 'Colombia', tier: 2 },
  '152': { code: 'cl', name: 'Chile', flag: '🇨🇱', label: 'Chile', tier: 2 },
  '604': { code: 'pe', name: 'Peru', flag: '🇵🇪', label: 'Peru', tier: 2 },
  '068': { code: 'bo', name: 'Bolivia', flag: '🇧🇴', label: 'Bolivia', tier: 2 },
  '862': { code: 've', name: 'Venezuela', flag: '🇻🇪', label: 'Venezuela', tier: 2 },
  '218': { code: 'ec', name: 'Ecuador', flag: '🇪🇨', label: 'Ecuador', tier: 3 },
  '600': { code: 'py', name: 'Paraguay', flag: '🇵🇾', label: 'Paraguay', tier: 3 },
  '858': { code: 'uy', name: 'Uruguay', flag: '🇺🇾', label: 'Uruguay', tier: 3 },
  '826': { code: 'gb', name: 'United Kingdom', flag: '🇬🇧', label: 'United Kingdom', tier: 1 },
  '276': { code: 'de', name: 'Germany', flag: '🇩🇪', label: 'Germany', tier: 1 },
  '250': { code: 'fr', name: 'France', flag: '🇫🇷', label: 'France', tier: 1 },
  '380': { code: 'it', name: 'Italy', flag: '🇮🇹', label: 'Italy', tier: 1 },
  '724': { code: 'es', name: 'Spain', flag: '🇪🇸', label: 'Spain', tier: 1 },
  '528': { code: 'nl', name: 'Netherlands', flag: '🇳🇱', label: 'Netherlands', tier: 2 },
  '752': { code: 'se', name: 'Sweden', flag: '🇸🇪', label: 'Sweden', tier: 2 },
  '578': { code: 'no', name: 'Norway', flag: '🇳🇴', label: 'Norway', tier: 2 },
  '246': { code: 'fi', name: 'Finland', flag: '🇫🇮', label: 'Finland', tier: 2 },
  '616': { code: 'pl', name: 'Poland', flag: '🇵🇱', label: 'Poland', tier: 2 },
  '756': { code: 'ch', name: 'Switzerland', flag: '🇨🇭', label: 'Switzerland', tier: 2 },
  '040': { code: 'at', name: 'Austria', flag: '🇦🇹', label: 'Austria', tier: 2 },
  '056': { code: 'be', name: 'Belgium', flag: '🇧🇪', label: 'Belgium', tier: 2 },
  '372': { code: 'ie', name: 'Ireland', flag: '🇮🇪', label: 'Ireland', tier: 2 },
  '620': { code: 'pt', name: 'Portugal', flag: '🇵🇹', label: 'Portugal', tier: 2 },
  '300': { code: 'gr', name: 'Greece', flag: '🇬🇷', label: 'Greece', tier: 2 },
  '643': { code: 'ru', name: 'Russia', flag: '🇷🇺', label: 'Russia', tier: 1 },
  '792': { code: 'tr', name: 'Turkey', flag: '🇹🇷', label: 'Turkey', tier: 1 },
  '804': { code: 'ua', name: 'Ukraine', flag: '🇺🇦', label: 'Ukraine', tier: 2 },
  '112': { code: 'by', name: 'Belarus', flag: '🇧🇾', label: 'Belarus', tier: 3 },
  '642': { code: 'ro', name: 'Romania', flag: '🇷🇴', label: 'Romania', tier: 2 },
  '100': { code: 'bg', name: 'Bulgaria', flag: '🇧🇬', label: 'Bulgaria', tier: 3 },
  '348': { code: 'hu', name: 'Hungary', flag: '🇭🇺', label: 'Hungary', tier: 3 },
  '203': { code: 'cz', name: 'Czechia', flag: '🇨🇿', label: 'Czechia', tier: 2 },
  '208': { code: 'dk', name: 'Denmark', flag: '🇩🇰', label: 'Denmark', tier: 2 },
  '356': { code: 'in', name: 'India', flag: '🇮🇳', label: 'India', tier: 1 },
  '156': { code: 'cn', name: 'China', flag: '🇨🇳', label: 'China', tier: 1 },
  '392': { code: 'jp', name: 'Japan', flag: '🇯🇵', label: 'Japan', tier: 1 },
  '410': { code: 'kr', name: 'South Korea', flag: '🇰🇷', label: 'S. Korea', tier: 1 },
  '360': { code: 'id', name: 'Indonesia', flag: '🇮🇩', label: 'Indonesia', tier: 1 },
  '036': { code: 'au', name: 'Australia', flag: '🇦🇺', label: 'Australia', tier: 1 },
  '554': { code: 'nz', name: 'New Zealand', flag: '🇳🇿', label: 'New Zealand', tier: 2 },
  '682': { code: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', label: 'Saudi Arabia', tier: 1 },
  '784': { code: 'ae', name: 'United Arab Emirates', flag: '🇦🇪', label: 'UAE', tier: 2 },
  '818': { code: 'eg', name: 'Egypt', flag: '🇪🇬', label: 'Egypt', tier: 1 },
  '710': { code: 'za', name: 'South Africa', flag: '🇿🇦', label: 'South Africa', tier: 1 },
  '566': { code: 'ng', name: 'Nigeria', flag: '🇳🇬', label: 'Nigeria', tier: 2 },
  '702': { code: 'sg', name: 'Singapore', flag: '🇸🇬', label: 'Singapore', tier: 3 },
  '458': { code: 'my', name: 'Malaysia', flag: '🇲🇾', label: 'Malaysia', tier: 2 },
  '764': { code: 'th', name: 'Thailand', flag: '🇹🇭', label: 'Thailand', tier: 2 },
  '608': { code: 'ph', name: 'Philippines', flag: '🇵🇭', label: 'Philippines', tier: 2 },
  '704': { code: 'vn', name: 'Vietnam', flag: '🇻🇳', label: 'Vietnam', tier: 2 },
  '586': { code: 'pk', name: 'Pakistan', flag: '🇵🇰', label: 'Pakistan', tier: 2 },
  '050': { code: 'bd', name: 'Bangladesh', flag: '🇧🇩', label: 'Bangladesh', tier: 2 },
  '376': { code: 'il', name: 'Israel', flag: '🇮🇱', label: 'Israel', tier: 3 },
  '404': { code: 'ke', name: 'Kenya', flag: '🇰🇪', label: 'Kenya', tier: 2 },
  '504': { code: 'ma', name: 'Morocco', flag: '🇲🇦', label: 'Morocco', tier: 2 },
  '012': { code: 'dz', name: 'Algeria', flag: '🇩🇿', label: 'Algeria', tier: 2 },
  '231': { code: 'et', name: 'Ethiopia', flag: '🇪🇹', label: 'Ethiopia', tier: 2 },
  '398': { code: 'kz', name: 'Kazakhstan', flag: '🇰🇿', label: 'Kazakhstan', tier: 1 },
  '364': { code: 'ir', name: 'Iran', flag: '🇮🇷', label: 'Iran', tier: 2 },
  '368': { code: 'iq', name: 'Iraq', flag: '🇮🇶', label: 'Iraq', tier: 2 },
  '496': { code: 'mn', name: 'Mongolia', flag: '🇲🇳', label: 'Mongolia', tier: 2 },
  '860': { code: 'uz', name: 'Uzbekistan', flag: '🇺🇿', label: 'Uzbekistan', tier: 2 },
  '004': { code: 'af', name: 'Afghanistan', flag: '🇦🇫', label: 'Afghanistan', tier: 3 },
  '524': { code: 'np', name: 'Nepal', flag: '🇳🇵', label: 'Nepal', tier: 3 },
  '144': { code: 'lk', name: 'Sri Lanka', flag: '🇱🇰', label: 'Sri Lanka', tier: 3 },
  '104': { code: 'mm', name: 'Myanmar', flag: '🇲🇲', label: 'Myanmar', tier: 2 },
  '418': { code: 'la', name: 'Laos', flag: '🇱🇦', label: 'Laos', tier: 3 },
  '116': { code: 'kh', name: 'Cambodia', flag: '🇰🇭', label: 'Cambodia', tier: 3 },
  '434': { code: 'ly', name: 'Libya', flag: '🇱🇾', label: 'Libya', tier: 2 },
  '788': { code: 'tn', name: 'Tunisia', flag: '🇹🇳', label: 'Tunisia', tier: 3 },
  '834': { code: 'tz', name: 'Tanzania', flag: '🇹🇿', label: 'Tanzania', tier: 2 },
  '508': { code: 'mz', name: 'Mozambique', flag: '🇲🇿', label: 'Mozambique', tier: 2 },
  '024': { code: 'ao', name: 'Angola', flag: '🇦🇴', label: 'Angola', tier: 2 },
  '516': { code: 'na', name: 'Namibia', flag: '🇳🇦', label: 'Namibia', tier: 3 },
  '072': { code: 'bw', name: 'Botswana', flag: '🇧🇼', label: 'Botswana', tier: 3 },
  '716': { code: 'zw', name: 'Zimbabwe', flag: '🇿🇼', label: 'Zimbabwe', tier: 3 },
  '894': { code: 'zm', name: 'Zambia', flag: '🇿🇲', label: 'Zambia', tier: 3 },
  '120': { code: 'cm', name: 'Cameroon', flag: '🇨🇲', label: 'Cameroon', tier: 3 },
  '288': { code: 'gh', name: 'Ghana', flag: '🇬🇭', label: 'Ghana', tier: 3 },
  '384': { code: 'ci', name: 'Ivory Coast', flag: '🇨🇮', label: 'Ivory Coast', tier: 3 },
  '686': { code: 'sn', name: 'Senegal', flag: '🇸🇳', label: 'Senegal', tier: 3 },
  '450': { code: 'mg', name: 'Madagascar', flag: '🇲🇬', label: 'Madagascar', tier: 3 }
};

const geo = JSON.parse(fs.readFileSync('countries-geo.json', 'utf8'));
const countries = geo.features.filter(f => f.id !== '010' && f.properties.name !== 'Antarctica');

const projection = d3.geoNaturalEarth1().fitExtent([[15, 15], [985, 505]], { type: 'FeatureCollection', features: countries });
const pathGenerator = d3.geoPath().projection(projection);

const LABEL_OVERRIDES = {
  us: { x: 230, y: 175 },
  ca: { x: 235, y: 105 },
  mx: { x: 215, y: 240 },
  br: { x: 360, y: 340 },
  ar: { x: 330, y: 430 },
  co: { x: 285, y: 285 },
  cl: { x: 320, y: 417 },
  pe: { x: 295, y: 335 },
  gb: { x: 485, y: 135 },
  fr: { x: 495, y: 175 },
  de: { x: 520, y: 155 },
  es: { x: 475, y: 200 },
  it: { x: 530, y: 195 },
  pt: { x: 465, y: 195 },
  nl: { x: 512, y: 140 },
  pl: { x: 545, y: 145 },
  se: { x: 530, y: 105 },
  no: { x: 505, y: 95 },
  fi: { x: 556, y: 97 },
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
  my: { x: 799, y: 285 },
  th: { x: 772, y: 249 },
  vn: { x: 786, y: 244 },
  ph: { x: 833, y: 259 },
  kz: { x: 662, y: 145 },
  tr: { x: 585, y: 190 },
  ua: { x: 575, y: 141 }
};

let labelsSvg = '';
let pinCoords = {};

countries.forEach(feature => {
  const numId = String(feature.id).padStart(3, '0');
  const info = ISO_NUM_TO_ALPHA2[numId] || ISO_NUM_TO_ALPHA2[String(parseInt(numId, 10))];
  const rawName = feature.properties.name || `Country ${numId}`;
  const code = info ? info.code : `c${numId}`;
  const name = info ? info.name : rawName;
  const labelText = info && info.label ? info.label : rawName;
  const tier = info && info.tier ? info.tier : 3;

  const centroid = pathGenerator.centroid(feature);
  if (!centroid || isNaN(centroid[0]) || isNaN(centroid[1])) return;

  const cx = Math.round(centroid[0]);
  const cy = Math.round(centroid[1]);
  const pos = (code && LABEL_OVERRIDES[code]) ? LABEL_OVERRIDES[code] : { x: cx, y: cy };

  pinCoords[code] = { x: pos.x, y: pos.y };

  const fontSize = tier === 1 ? '9.5px' : tier === 2 ? '8px' : '6.8px';
  const tierClass = tier === 1 ? 'map-lbl-major' : tier === 2 ? 'map-lbl-medium' : 'map-lbl-detail';

  labelsSvg += `  <text class="map-country-name-label ${tierClass}" data-code="${code}" x="${pos.x}" y="${pos.y}" font-size="${fontSize}">${labelText}</text>\n`;
});

fs.writeFileSync('all_country_labels.svg', labelsSvg, 'utf8');
fs.writeFileSync('all_pin_coords.json', JSON.stringify(pinCoords, null, 2), 'utf8');
console.log('Successfully generated full labels for all', countries.length, 'countries!');
