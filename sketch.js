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
let gridStroke = [75];
let gridLabelOffset = 12;
let gridFontPath = 'typefaces/SohneMono-Leicht.otf';
let gridFontSize = 11;

// Map appearance
let strokeWeightMap = 1.1;
let fontSize = 9.8;
let condensedFontPath = 'typefaces/authentic-sans-condensed-60.otf';

// Agent settings
let agentScaleFactor = 0.00003;
let agentSize = 11;
let agentSpeed = 10; // pixels per second
let rotationSpeed = 3.0; // radians per second for smooth rotation

// =========================
// --- COUNTRY LABEL ---
// =========================
let countryLabel = "Sudan";
let countryLabelFontPath = 'typefaces/authentic-sans-90.otf'; // updated font
let countryLabelSize = 13;
let countryLabelColor = [135]; // grey
let countryLabelX, countryLabelY;
let countryLabelFont;

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
let topographyImg;
let maskGraphics;
let isPaused = false;
let showMap = true;
let showTrajectories = false; // new toggle for agent paths
let lastTime = 0;

// =========================
// --- SETUP & DRAW ---
// =========================
function preload() {
  sudanGeo = loadJSON('map.json'); // your geojson
  idpData = loadJSON('data.json'); // your IDP data
  condensedFont = loadFont(condensedFontPath);
  customFont = loadFont(gridFontPath);
  countryLabelFont = loadFont(countryLabelFontPath); // preload updated label font
  topographyImg = loadImage('topography.png');
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  calculateProjection();
  calculateCentroids();
  prepareAgents();
  frameRate(60);
  lastTime = millis();
  
  // center the country label on canvas
  countryLabelX = width / 2;
  countryLabelY = height / 2;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  calculateProjection();
  calculateCentroids();
  prepareAgents();
  countryLabelX = width / 2;
  countryLabelY = height / 2;
}

// =========================
// --- MAIN DRAW ---
// =========================
function draw() {
  background(0); // changeable for visibility
  let currentTime = millis();
  let deltaTimeSec = (currentTime - lastTime) / 1000.0;
  lastTime = currentTime;

  // --- Draw map (only if visible) ---
  if (sudanGeo && showMap) {
    drawTopography();         // clipped to outer border
    drawGeoJSON(sudanGeo);    // state outlines
    drawLabels(sudanGeo);     // state labels
    drawCountryLabel();       // central country label
  }

  // --- Grid stays visible whether map is hidden or not ---
  drawGrid();

  // --- Draw agent trajectories if toggled ---
  if (showTrajectories) {
    drawAgentTrajectories();
  }

  // --- Agents animation or static display ---
  if (!isPaused) {
    updateAndDrawAgents(deltaTimeSec);
  } else {
    drawAgentsOnly();
  }

  // --- Compass & Scale Bar ALWAYS visible ---
  drawCompassAndScaleBar();
}

// =========================
// --- COMPASS & SCALE BAR ---
// =========================
function drawCompassAndScaleBar() {
  push();
  let padding = 0;
  let baseCompassRadius = 11.3; // original radius
  let compassRadius = baseCompassRadius * (mapScale / 40); // scale with map

  // --- Determine nice scale bar length dynamically ---
  let mapWidthKm = (lonMax - lonMin) * 111.32 * Math.cos(radians((latMin + latMax) / 2));
  let targetLengthKm = mapWidthKm / 6;
  let niceSteps = [50, 100, 200, 500, 1000, 2000, 5000];
  let scaleBarLengthKm = niceSteps.find(s => s >= targetLengthKm) || niceSteps[niceSteps.length - 1];
  let pixelsPerKm = distanceInPixels(scaleBarLengthKm);

  // --- Position aligned relative to latitude/longitude grid ---
  let [gridRightX, gridBottomY] = project(lonMax, latMin);
  let [gridLeftX, gridTopY] = project(lonMin, latMax);

  let scaleX = gridRightX - pixelsPerKm - 20;
  let scaleY = gridBottomY + 5;

  // Place compass above and right-aligned with scale bar
  let compassX = scaleX + pixelsPerKm; // right edge of scale bar
  let compassY = scaleY - 28 * (mapScale / 40) - compassRadius; // scale vertical offset too

  // --- Scale bar (alternating filled rectangles) ---
  strokeWeight(0.1 * (mapScale / 40));
  let increments = 4;
  let blockWidth = pixelsPerKm / increments;
  let blockHeight = 6 * (mapScale / 40); // scale block height

  rectMode(CORNER);
  for (let i = 0; i < increments; i++) {
    let bx = scaleX + i * blockWidth;
    if (i % 2 === 0) fill(0);
    else fill(30);
    rect(bx, scaleY - blockHeight / 2, blockWidth, blockHeight);
    noFill();
    stroke(245);
    rect(bx, scaleY - blockHeight / 2, blockWidth, blockHeight);
  }

  // Outer outline
  noFill();
  stroke(245);
  rect(scaleX, scaleY - blockHeight / 2, pixelsPerKm, blockHeight);

  // --- Labels ABOVE block edges ---
  noStroke();
  fill(245);
  textAlign(CENTER, BOTTOM);
  textSize(9 * (mapScale / 40));
  for (let i = 0; i <= increments; i++) {
    let lx = scaleX + i * blockWidth;
    let label = Math.round((scaleBarLengthKm / increments) * i);
    if (i === increments) label += "km";
    text(label, lx, scaleY - blockHeight / 2 - 4 * (mapScale / 40));
  }

  // --- Compass as a cross ---
  stroke(245);
  strokeWeight(0.4 * (mapScale / 40));
  // vertical line (North)
  line(compassX, compassY - compassRadius, compassX, compassY + compassRadius);
  // horizontal line (East-West)
  line(compassX - compassRadius, compassY, compassX + compassRadius, compassY);

  fill(245);
  noStroke();
  textAlign(CENTER, BOTTOM);
  textSize(9 * (mapScale / 40)); // scale 'N' label
  text('N', compassX, compassY - compassRadius - 1.7 * (mapScale / 40));

  pop();
}

// --- Convert km distance to pixels based on map scale ---
function distanceInPixels(km) {
  let centerLat = (latMin + latMax) / 2;
  let kmPerDeg = 111.32;
  let deg = km / kmPerDeg;
  let [x0, y0] = project(lonMin, centerLat);
  let [x1, y1] = project(lonMin + deg, centerLat);
  return abs(x1 - x0);
}

// =========================
// --- DRAW COUNTRY LABEL ---
// =========================
function drawCountryLabel() {
  if (!showMap) return; // hide if map is hidden

  // Scale country label font size with map
  let scaledLabelSize = countryLabelSize * (mapScale / 40); // adjust divisor to taste
  textFont(countryLabelFont);
  textSize(scaledLabelSize);
  textAlign(CENTER, CENTER);
  
  // measure the text
  let w = textWidth(countryLabel);
  let h = scaledLabelSize; // roughly font size is height

  // draw white box behind text
  noStroke();
  fill(245);
  rectMode(CENTER);
  rect(countryLabelX, countryLabelY, w, h);

  // draw text
  fill(...countryLabelColor);
  text(countryLabel, countryLabelX, countryLabelY);
}

// =========================
// --- DRAW TOPOGRAPHY CLIPPED TO OUTER BORDER ---
// =========================
function drawTopography() {
  if (!topographyImg || !sudanGeo) return;

  let clipped = createGraphics(width, height);
  clipped.pixelDensity(1);
  clipped.clear();
  clipped.noStroke();
  let ctx = clipped.drawingContext;
  ctx.save();

  ctx.beginPath();
  for (let feature of sudanGeo.features) {
    let geom = feature.geometry;
    if (geom.type === "Polygon") {
      addPathPointsToContext(ctx, geom.coordinates[0]);
    } else if (geom.type === "MultiPolygon") {
      for (let poly of geom.coordinates) {
        addPathPointsToContext(ctx, poly[0]);
      }
    }
  }
  ctx.clip();

  clipped.imageMode(CORNERS);
  let [x0, y0] = project(lonMin, latMax);
  let [x1, y1] = project(lonMax, latMin);
  clipped.image(topographyImg, x0, y0, x1, y1);

  ctx.restore();
  imageMode(CORNER);
  image(clipped, 0, 0);
  clipped.remove();
}

function addPathPointsToContext(ctx, ring) {
  if (!ring || ring.length === 0) return;
  let first = ring[0];
  let p = project(first[0], first[1]);
  ctx.moveTo(p[0], p[1]);
  for (let i = 1; i < ring.length; i++) {
    let c = ring[i];
    let pt = project(c[0], c[1]);
    ctx.lineTo(pt[0], pt[1]);
  }
  ctx.closePath();
}
// =========================
// --- AGENTS (SCALED) ---
// =========================
function drawAgentsOnly() {
  // visual stroke scaled to map
  let scaledStroke = 1 * (mapScale / 50);
  strokeWeight(scaledStroke);
  fill(0, 255, 0);
  stroke(0);
  for (let a of agents) {
    drawAgentTriangle(a);
  }
}

function drawAgentTriangle(a) {
  push();
  translate(a.x, a.y);
  rotate(a.rotation + PI / 2);
  // scale agent size proportionally with map
  let scaledSize = agentSize * (mapScale / 40);
  beginShape();
  vertex(0, -scaledSize * 0.5);
  vertex(-scaledSize * 0.5, scaledSize * 0.5);
  vertex(scaledSize * 0.5, scaledSize * 0.5);
  endShape(CLOSE);
  pop();
}

function drawAgentTrajectories() {
  // trajectory stroke scaled to match agents
  let scaledStroke = 1 * (mapScale / 50);
  stroke(0, 255, 0);
  strokeWeight(scaledStroke);
  for (let a of agents) {
    line(a.originPos[0], a.originPos[1], a.x, a.y);
  }
}

function updateAndDrawAgents(dt) {
  // keep same movement behaviour, but draw with scaled stroke/size
  let scaledStroke = 1 * (mapScale / 50);
  strokeWeight(scaledStroke);
  fill(0, 255, 0);
  stroke(0);

  for (let a of agents) {
    if (a.pauseFrames > 0) {
      a.pauseFrames--;
      if (a.pauseFrames === 0) a.targetRotation = a.rotation + PI;
    } else {
      let dx = a.currentTarget[0] - a.x;
      let dy = a.currentTarget[1] - a.y;
      let distToTarget = sqrt(dx * dx + dy * dy);
      let step = agentSpeed * dt; // movement unchanged (pixels/sec)
      if (distToTarget > step) {
        a.x += dx * (step / distToTarget);
        a.y += dy * (step / distToTarget);
        a.targetRotation = atan2(dy, dx);
      } else {
        a.currentTarget = (a.currentTarget === a.targetPos) ? a.originPos : a.targetPos;
        a.pauseFrames = 120;
      }
    }

    a.rotation = lerpAngle(a.rotation, a.targetRotation, min(1, rotationSpeed * dt));
    drawAgentTriangle(a);
  }
}

// =========================
// --- KEYBOARD HANDLING ---
// =========================
function keyPressed() {
  if (key === ' ') isPaused = !isPaused;
  if (key === 'F' || key === 'f') fullscreen(!fullscreen());
  if (key === 'H' || key === 'h') showMap = !showMap;
  if (key === 'L' || key === 'l') showTrajectories = !showTrajectories; // toggle trajectories
  if (key === 'E' || key === 'e') exportTrajectoriesSVG(); // export trajectories as SVG
}

// =========================
// --- EXPORT AGENT TRAJECTORIES AS SVG ---
// =========================
function exportTrajectoriesSVG() {
  if (agents.length === 0) {
    console.log("No agents to export.");
    return;
  }

  // Determine bounds (min/max)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (let a of agents) {
    let x1 = a.originPos[0];
    let y1 = a.originPos[1];
    let x2 = a.targetPos[0];
    let y2 = a.targetPos[1];
    minX = Math.min(minX, x1, x2);
    minY = Math.min(minY, y1, y2);
    maxX = Math.max(maxX, x1, x2);
    maxY = Math.max(maxY, y1, y2);
  }

  // Add small padding around edges
  let padding = 0;
  minX -= padding;
  minY -= padding;
  maxX += padding;
  maxY += padding;

  let widthSVG = maxX - minX;
  let heightSVG = maxY - minY;

  // SVG header with calculated viewBox
  let svgHeader = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n`;
  svgHeader += `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${widthSVG}" height="${heightSVG}" viewBox="${minX} ${minY} ${widthSVG} ${heightSVG}">\n`;

  // Add individual black lines
  let svgContent = "";
  for (let a of agents) {
    let x1 = a.originPos[0];
    let y1 = a.originPos[1];
    let x2 = a.targetPos[0];
    let y2 = a.targetPos[1];
    svgContent += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="black" stroke-width="1" />\n`;
  }

  // SVG footer
  let svgFooter = `</svg>`;

  // Combine
  let svgData = svgHeader + svgContent + svgFooter;

  // Create and download
  let blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  let url = URL.createObjectURL(blob);
  let link = document.createElement("a");
  link.href = url;
  link.download = "agent_trajectories.svg";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  console.log("SVG exported with bounding box: agent_trajectories.svg");
}

// =========================
// --- MAP PROJECTION ---
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
  strokeWeight(strokeWeightMap * (mapScale / 40)); // scale stroke with map
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
  fill(255, 0, 0);

  // Scale label font size with map
  let scaledFontSize = fontSize * (mapScale / 40); // adjust divisor to taste
  textSize(scaledFontSize);
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
        text(lines[0], cx, cy - scaledFontSize / 2);
        text(lines[1], cx, cy + scaledFontSize / 2);
      } else {
        text(name, cx, cy);
      }
    }
  }
}

// =========================
// --- CENTROIDS & GRID ---
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
  strokeWeight(1 * (mapScale / 40));
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

// scale grid label text with map
let scaledGridFontSize = gridFontSize * (mapScale / 40);

textFont(customFont);
textSize(scaledGridFontSize);
fill(75);
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
        let initialAngle = atan2(end[1] - start[1], end[0] - start[0]);

        agents.push({
          x: start[0],
          y: start[1],
          originPos: start,
          targetPos: end,
          currentTarget: end,
          origin: origin,
          destination: dest,
          pauseFrames: 0,
          rotation: initialAngle,
          targetRotation: initialAngle
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
    if (pointInPolygon([x, y], poly.map(c => project(c[0], c[1])))) return [x, y];
  }
  return polygonCentroid(polygons[0][0]);
}


function lerpAngle(a, b, t) {
  let diff = (b - a + PI) % (2 * PI) - PI;
  return a + diff * t;
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

// =========================
// --- MOUSE HANDLING ---
// =========================
function mousePressed() {
  fullscreen(!fullscreen());
}