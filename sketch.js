// =========================
// --- GLOBAL SETTINGS ---
// =========================

// Map positioning & scaling
let mapShiftX = 0;             
let mapScaleFactor = 0.73;    
let mapVerticalOffset = 0.125; 

// Grid and text styling
let gridStep = 2;         
let gridDash = [3, 5];    
let gridStroke = [220, 130];
let gridLabelOffset = 12;  
let gridFontPath = 'typefaces/SohneMono-Leicht.otf';
let gridFontSize = 11;

// Map appearance
let strokeWeightMap = 1.1; 
let fontSize = 9.8;         
let condensedFontPath = 'typefaces/authentic-sans-condensed-60.otf';

// Solar irradiance gradient (NW dark red → SE light yellow/green)
const solarGradientColors = [
  [255, 0, 0],     
  [255, 90, 0],    
  [255, 120, 0],   
  [255, 190, 0],   
  [200, 255, 50]   
];

// Agent settings
let agentScaleFactor = 0.00003; 
let agentSize = 11; 
let agentSpeed = 1; // fixed speed per frame

// =========================
// --- STATE NAME MAPPING ---
// =========================
const geoToDataStateNames = {
  "Gezira": "Aj Jazirah",
  "Gadarif": "Gedaref",
  "Blue Nile": "Blue Nile",
  "Central Darfur": "Central Darfur",
  "East Darfur": "East Darfur",
  "Khartoum": "Khartoum",
  "North Darfur": "North Darfur",
  "North Kordofan": "North Kordofan",
  "Northern": "Northern",
  "Red Sea": "Red Sea",
  "River Nile": "River Nile",
  "Sennar": "Sennar",
  "South Darfur": "South Darfur",
  "South Kordofan": "South Kordofan",
  "West Darfur": "West Darfur",
  "West Kordofan": "West Kordofan",
  "White Nile": "White Nile",
  "Kassala": "Kassala"
};

// =========================
// --- GLOBAL VARIABLES ---
// =========================
let sudanGeo;
let idpData;
let agents = [];
let stateCentroids = {};
let mapScale, offsetX, offsetY;
let lonMin, lonMax, latMin, latMax;
let condensedFont, customFont;
let isPaused = false; // For spacebar pause/resume

// =========================
// --- SETUP & DRAW ---
// =========================
function preload() {
  sudanGeo = loadJSON('map.json');
  idpData = loadJSON('data.json'); 
  condensedFont = loadFont(condensedFontPath); 
  customFont = loadFont(gridFontPath);
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  calculateProjection();
  calculateCentroids();
  prepareAgents();
  frameRate(60);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateProjection();
  calculateCentroids();
  prepareAgents();
}

// =========================
// --- MAIN DRAW ---
// =========================
function draw() {
  background(0);

  if (sudanGeo) {
    drawSolarMapGradient();  
    drawGeoJSON(sudanGeo);  
    drawGrid();
    drawLabels(sudanGeo);

    if (!isPaused) {
      updateAndDrawAgents();
    } else {
      drawAgentsOnly();
    }
  }
}

// =========================
// --- DRAW AGENTS ONLY ---
// =========================
function drawAgentsOnly() {
  fill(0, 255, 0);
  stroke(0);
  strokeWeight(1);

  for (let a of agents) {
    let angle = atan2(a.currentTarget[1] - a.y, a.currentTarget[0] - a.x);
    push();
    translate(a.x, a.y);
    rotate(angle + PI/2);
    beginShape();
    vertex(0, -agentSize*0.5);
    vertex(-agentSize*0.5, agentSize*0.5);
    vertex(agentSize*0.5, agentSize*0.5);
    endShape(CLOSE);
    pop();
  }
}

// =========================
// --- KEYBOARD HANDLING ---
// =========================
function keyPressed() {
  if (key === ' ') { // Spacebar to pause/resume
    isPaused = !isPaused;
  }
  if (key === 'F' || key === 'f') { // F to toggle fullscreen
    let fs = fullscreen();
    fullscreen(!fs);
  }
}

// =========================
// --- SOLAR GRADIENT ---
// =========================
function drawSolarMapGradient() {
  const colors = solarGradientColors.map(c => color(...c));
  noStroke();

  for (let feature of sudanGeo.features) {
    let geom = feature.geometry;
    let polygons = (geom.type === "Polygon") ? [geom.coordinates] : geom.coordinates;

    for (let poly of polygons) {
      beginShape();
      for (let c of poly[0]) {
        let lon = c[0];
        let lat = c[1];
        let [x, y] = project(lon, lat);

        let tLon = map(lon, lonMin, lonMax, 0.3, 1); 
        let tLat = map(lat, latMin, latMax, 1, 0); 
        let t = (0.45 * tLon + 0.75 * tLat) / 1.2;
        t = constrain(t, 0, 1);

        let idx = floor(t * (colors.length - 1));
        let frac = t * (colors.length - 1) - idx;
        let cColor = lerpColor(colors[idx], colors[min(idx + 1, colors.length - 1)], frac);

        fill(cColor);
        vertex(x, y);
      }
      endShape(CLOSE);
    }
  }
}

// =========================
// --- MAP PROJECTION & GEOJSON ---
// =========================
function calculateProjection() {
  let bounds = getBounds(sudanGeo);
  lonMin = bounds[0]; latMin = bounds[1]; lonMax = bounds[2]; latMax = bounds[3];

  let lonRange = lonMax - lonMin;
  let latRange = latMax - latMin;
  let mapAspect = lonRange / latRange;
  let canvasAspect = width / height;

  if (mapAspect > canvasAspect) {
    mapScale = (width * mapScaleFactor) / lonRange;
    offsetX = width * (0.125 + mapShiftX);
    offsetY = (height - latRange * mapScale) / 2;
  } else {
    mapScale = (height * mapScaleFactor) / latRange;
    offsetY = height * mapVerticalOffset;
    offsetX = (width - lonRange * mapScale) / 2 + width * mapShiftX;
  }
}

function project(lon, lat) {
  let x = offsetX + (lon - lonMin) * mapScale;
  let y = offsetY + (latMax - lat) * mapScale;
  return [x, y];
}

function drawGeoJSON(geo) {
  noFill();
  stroke(0);
  strokeWeight(strokeWeightMap);

  for (let feature of geo.features) {
    let geom = feature.geometry;
    if (geom.type === "Polygon") drawPolygon(geom.coordinates);
    else if (geom.type === "MultiPolygon") {
      for (let poly of geom.coordinates) drawPolygon(poly);
    }
  }
}

function drawPolygon(coords) {
  beginShape();
  for (let c of coords[0]) {
    let [x, y] = project(c[0], c[1]);
    vertex(x, y);
  }
  endShape(CLOSE);
}

// =========================
// --- LABELS ---
// =========================
function drawLabels(geo) {
  noStroke();
  fill(0);
  textSize(fontSize);
  textFont(condensedFont); 
  textAlign(CENTER, CENTER);

  const splitStates = {
    "West Darfur": ["West", "Darfur"],
    "Central Darfur": ["Central", "Darfur"],
    "White Nile": ["White", "Nile"]
  };

  for (let feature of geo.features) {
    let originalName = feature.properties.name || feature.properties.NAME_1 || "Unnamed";
    let name = geoToDataStateNames[originalName] || originalName;
    let ring = (feature.geometry.type === "Polygon") ? feature.geometry.coordinates[0] : feature.geometry.coordinates[0][0];

    if (ring) {
      let [cx, cy] = polygonCentroid(ring);
      if (splitStates[name]) {
        let lines = splitStates[name];
        text(lines[0], cx, cy - fontSize / 2);
        text(lines[1], cx, cy + fontSize / 2);
      } else {
        text(name, cx, cy);
      }
    }
  }
}

// =========================
// --- CENTROIDS & BOUNDS ---
// =========================
function polygonCentroid(ring) {
  let area = 0, cx = 0, cy = 0;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    let [x0, y0] = project(ring[i][0], ring[i][1]);
    let [x1, y1] = project(ring[(i + 1) % n][0], ring[(i + 1) % n][1]);
    let a = x0 * y1 - x1 * y0;
    area += a;
    cx += (x0 + x1) * a;
    cy += (y0 + y1) * a;
  }
  area /= 2;
  cx /= 6 * area;
  cy /= 6 * area;
  return [cx, cy];
}

function getBounds(geo) {
  let lonMin = Infinity, latMin = Infinity, lonMax = -Infinity, latMax = -Infinity;
  for (let f of geo.features) {
    let geom = f.geometry;
    let polys = (geom.type === "Polygon") ? [geom.coordinates] : geom.coordinates;
    for (let poly of polys) {
      for (let c of poly[0]) {
        lonMin = min(lonMin, c[0]);
        lonMax = max(lonMax, c[0]);
        latMin = min(latMin, c[1]);
        latMax = max(latMax, c[1]);
      }
    }
  }
  return [lonMin, latMin, lonMax, latMax];
}

// =========================
// --- GRID ---
// =========================
function drawGrid() {
  stroke(...gridStroke);
  strokeWeight(1);
  drawingContext.setLineDash(gridDash);

  let lonMinR = Math.floor(lonMin);
  let lonMaxR = Math.ceil(lonMax);
  let latMinR = Math.floor(latMin);
  let latMaxR = Math.ceil(latMax);

  for (let lat = latMinR; lat <= latMaxR; lat += gridStep) {
    let [x1, y1] = project(lonMinR, lat);
    let [x2, y2] = project(lonMaxR, lat);
    line(x1, y1, x2, y2);
  }

  for (let lon = lonMinR; lon <= lonMaxR; lon += gridStep) {
    let [x1, y1] = project(lon, latMinR);
    let [x2, y2] = project(lon, latMaxR);
    line(x1, y1, x2, y2);
  }

  drawingContext.setLineDash([]);

  textFont(customFont); 
  textSize(gridFontSize);
  fill(220,130);
  noStroke();

  textAlign(RIGHT, CENTER);
  for (let lat = latMinR; lat <= latMaxR; lat += gridStep) {
    let [x, y] = project(lonMinR, lat);
    text(lat + "°N", x - gridLabelOffset, y);
  }

  textAlign(CENTER, TOP);
  for (let lon = lonMinR; lon <= lonMaxR; lon += gridStep) {
    let [x, y] = project(lon, latMinR);
    text(lon + "°E", x, y + gridLabelOffset);
  }
}

// =========================
// --- AGENTS ---
// =========================
function calculateCentroids() {
  stateCentroids = {};
  for (let feature of sudanGeo.features) {
    let originalName = feature.properties.name || feature.properties.NAME_1;
    let name = geoToDataStateNames[originalName] || originalName;
    let geom = feature.geometry;
    let ring = (geom.type === "Polygon") ? geom.coordinates[0] : geom.coordinates[0][0];
    stateCentroids[name] = polygonCentroid(ring);
  }
}

function prepareAgents() {
  agents = [];
  let displacementRows = idpData.data.filter(d => d.state_of_displacement !== "Total");
  let totalEntry = idpData.data.find(d => d.state_of_displacement === "Total");
  if (!totalEntry) return;

  for (let origin in totalEntry.by_state_of_origin) {
    let originCount = totalEntry.by_state_of_origin[origin];
    if (originCount <= 0) continue;

    let originFeature = sudanGeo.features.find(f => {
      let name = geoToDataStateNames[f.properties.name || f.properties.NAME_1] || f.properties.name;
      return name === origin;
    });
    if (!originFeature) continue;
    let originPolygons = (originFeature.geometry.type === "Polygon") ? [originFeature.geometry.coordinates] : originFeature.geometry.coordinates;

    for (let d of displacementRows) {
      let dest = d.state_of_displacement;
      let count = d.by_state_of_origin[origin] || 0;
      if (count <= 0) continue;

      let destFeature = sudanGeo.features.find(f => {
        let name = geoToDataStateNames[f.properties.name || f.properties.NAME_1] || f.properties.name;
        return name === dest;
      });
      if (!destFeature) continue;
      let destPolygons = (destFeature.geometry.type === "Polygon") ? [destFeature.geometry.coordinates] : destFeature.geometry.coordinates;

      let nAgents = floor(count * agentScaleFactor);
      nAgents = max(nAgents, 1);

      for (let i = 0; i < nAgents; i++) {
        let start = randomPointInPolygons(originPolygons);
        let end = randomPointInPolygons(destPolygons);

        agents.push({
          x: start[0],
          y: start[1],
          originPos: start,
          targetPos: end,
          currentTarget: end,
          origin: origin,
          destination: dest
        });
      }
    }
  }
  console.log("Agents prepared:", agents.length);
}

function randomPointInPolygons(polygons) {
  for (let tries = 0; tries < 1000; tries++) {
    let poly = polygons[floor(random(polygons.length))][0]; 
    let xs = poly.map(c => project(c[0], c[1])[0]);
    let ys = poly.map(c => project(c[0], c[1])[1]);
    let minX = min(xs), maxX = max(xs), minY = min(ys), maxY = max(ys);

    let x = random(minX, maxX);
    let y = random(minY, maxY);

    if (pointInPolygon([x, y], poly.map(c => project(c[0], c[1])))) {
      return [x, y];
    }
  }
  return polygonCentroid(polygons[0][0]);
}

function updateAndDrawAgents() {
  fill(0, 255, 0);
  stroke(0);
  strokeWeight(1);

  for (let a of agents) {
    if (a.pauseFrames && a.pauseFrames > 0) {
      a.pauseFrames--;
    } else {
      let dx = a.currentTarget[0] - a.x;
      let dy = a.currentTarget[1] - a.y;
      let distToTarget = sqrt(dx*dx + dy*dy);

      if (distToTarget > 1) {
        a.x += dx * agentSpeed / distToTarget;
        a.y += dy * agentSpeed / distToTarget;
      } else {
        a.currentTarget = (a.currentTarget === a.targetPos) ? a.originPos : a.targetPos;
        a.pauseFrames = 120;
      }
    }

    let angle = atan2(a.currentTarget[1] - a.y, a.currentTarget[0] - a.x);
    push();
    translate(a.x, a.y);
    rotate(angle + PI/2);
    beginShape();
    vertex(0, -agentSize*0.5);
    vertex(-agentSize*0.5, agentSize*0.5);
    vertex(agentSize*0.5, agentSize*0.5);
    endShape(CLOSE);
    pop();
  }
}

function pointInPolygon(point, vs) {
  let x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1];
    let xj = vs[j][0], yj = vs[j][1];

    let intersect = ((yi > y) != (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi + 0.0000001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}