const fs = require('fs');

const htmlPath = 'public/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

// 1. Update Mine Competitors -> Hunt Competitors
html = html.replace(
  /<div class="card-title">Mine Competitors<\/div>\s*<div class="card-sub">[^<]*<\/div>/,
  '<div class="card-title">Hunt Competitors</div>\n                      <div class="card-sub">Find what your competitors are ranking for across SERPs</div>'
);

// 2. Inject all 176 country labels
const allLabels = fs.readFileSync('all_country_labels.svg', 'utf8');
const labelsRegex = /<g class="map-labels-group" id="map-labels-group">[\s\S]*?<\/g>/;

if (labelsRegex.test(html)) {
  html = html.replace(labelsRegex, `<g class="map-labels-group" id="map-labels-group">\n${allLabels}                        </g>`);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Successfully updated index.html with Hunt Competitors and all 176 country labels!');
} else {
  console.error('Could not find map-labels-group in index.html');
  process.exit(1);
}
