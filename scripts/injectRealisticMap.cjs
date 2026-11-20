const fs = require('fs');

const htmlPath = 'public/index.html';
let html = fs.readFileSync(htmlPath, 'utf8');

const paths = fs.readFileSync('generated_map_paths.svg', 'utf8');
const labels = fs.readFileSync('generated_map_labels.svg', 'utf8');

const newSvgContent = `                      <svg id="world-map-svg" viewBox="0 0 1000 520" class="world-map-svg" xmlns="http://www.w3.org/2000/svg">
                        <!-- Water Background (Realistic Google Maps blue) -->
                        <rect width="1000" height="520" fill="#EBF3FE" />
                        
                        <!-- Subtle Tactical Coordinate Graticules -->
                        <g class="map-graticule" stroke="#DCE8FA" stroke-width="0.75" stroke-dasharray="3 4">
                          <line x1="0" y1="130" x2="1000" y2="130" />
                          <line x1="0" y1="260" x2="1000" y2="260" />
                          <line x1="0" y1="390" x2="1000" y2="390" />
                          <line x1="200" y1="0" x2="200" y2="520" />
                          <line x1="400" y1="0" x2="400" y2="520" />
                          <line x1="600" y1="0" x2="600" y2="520" />
                          <line x1="800" y1="0" x2="800" y2="520" />
                        </g>

                        <!-- Realistic Country Landmasses -->
                        <g class="map-countries-group" id="map-countries-group">
${paths}                        </g>

                        <!-- Real Country Names Overlay with White Halos -->
                        <g class="map-labels-group" id="map-labels-group">
${labels}                        </g>

                        <!-- Dynamic Target Pin Markers -->
                        <g class="map-target-pins-group" id="map-target-pins-group"></g>
                      </svg>`;

// Replace from <svg id="world-map-svg" to </svg>
const svgStartRegex = /<svg id="world-map-svg"[\s\S]*?<\/svg>/;
if (svgStartRegex.test(html)) {
  html = html.replace(svgStartRegex, newSvgContent);
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log('Successfully injected realistic world map into public/index.html!');
} else {
  console.error('Could not find #world-map-svg in public/index.html');
  process.exit(1);
}
