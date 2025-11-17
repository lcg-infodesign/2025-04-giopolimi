let table;
let worldGeo;
let allCountries = [];
let selectedCountry = null;

// Pannello di dettaglio
let detailPanel = {
  open: false,
  x: 0,
  y: 0,
  width: 450,
  height: 550,
  currentView: 'info' // 'info' o 'graph'
};

// Variabili per trascinare la card
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

let indicators = [
  'Access to financial assets',
  'Access to justice',
  'Access to land assets',
  'Access to non-land assets',
  'Child marriage eradication',
  'Female genital mutilation eradication',
  'Freedom of movement',
  'Household responsibilities',
  'Political voice',
  'Violence against women eradication',
  'Workplace rights'
];

let colors = {};

function preload() {
  table = loadTable('data.csv', 'csv', 'header');
  worldGeo = loadJSON('countries.geojson');
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  textFont('Space Grotesk');
  
  // Assegna colori agli indicatori
  colorMode(HSB);
  let hueStep = 360 / indicators.length;
  for (let i = 0; i < indicators.length; i++) {
    colors[indicators[i]] = color(i * hueStep, 70, 85);
  }
  colorMode(RGB);
  
  // Carica tutti i dati
  loadAllData();
  console.log('Loaded countries:', allCountries.length);
  console.log('GeoJSON features:', worldGeo ? worldGeo.features.length : 0);
}

function draw() {
  background(20);
  
  // Disegna la mappa mondiale
  drawWorld();
  
  // Hover tooltip
  drawSimpleHover();
  
  // Legenda
  drawLegend();
  
  // Titolo
  drawTitle();
  
  // Pannello di dettaglio
  if (detailPanel.open && selectedCountry) {
    drawDetailPanel();
  }
}

function loadAllData() {
  allCountries = [];
  for (let i = 0; i < table.getRowCount(); i++) {
    try {
      let row = table.getRow(i);
      let getSafeNum = (colName) => {
        let val = row.get(colName);
        if (val === '' || val === null || val === undefined) return 0;
        let num = parseFloat(val);
        return isNaN(num) ? 0 : num;
      };
      
      let dataPoint = {
        country: row.getString('country'),
        value: getSafeNum('value'),
        uncertainty: getSafeNum('uncertainty'),
        latitude: getSafeNum('latitude'),
        longitude: getSafeNum('longitude'),
        total: getSafeNum('total'),
        average: getSafeNum('average'),
        indicators: {}
      };
      
      for (let ind of indicators) {
        dataPoint.indicators[ind] = getSafeNum(ind);
      }
      
      allCountries.push(dataPoint);
    } catch(e) {
      console.log('Error processing row', i, ':', e);
    }
  }
}

// Disegno mondo
function drawWorld() {
  if (!worldGeo || !worldGeo.features) return;
  
  push();
  stroke(255, 255, 255, 80);
  strokeWeight(0.5);
  
  for (let feature of worldGeo.features) {
    let countryName = feature.properties.ADMIN || feature.properties.name;
    let avgValue = getAverageForCountry(countryName);
    fill(getColorForAverage(avgValue));
    
    let geom = feature.geometry;
    if (!geom) continue;
    
    if (geom.type === 'Polygon') {
      drawPolygon(geom.coordinates);
    } else if (geom.type === 'MultiPolygon') {
      for (let poly of geom.coordinates) drawPolygon(poly);
    }
  }
  pop();
}

function drawPolygon(coordArray) {
  beginShape();
  for (let ring of coordArray) {
    for (let c of ring) {
      let lon = c[0];
      let lat = c[1];
      let x = map(lon, -180, 180, 0, width);
      let y = map(lat, 85, -85, 0, height);
      vertex(x, y);
    }
  }
  endShape(CLOSE);
}

function getAverageForCountry(geoCountryName) {
  if (!geoCountryName) return 0;
  for (let country of allCountries) {
    if (country.country.toLowerCase() === geoCountryName.toLowerCase() ||
        geoCountryName.toLowerCase().includes(country.country.toLowerCase()) ||
        country.country.toLowerCase().includes(geoCountryName.toLowerCase())) {
      return country.average;
    }
  }
  return 0;
}

function getColorForAverage(average) {
  if (average === 0) return color(80, 80, 80);
  let t = average / 100;
  if (t < 0.33) {
    return lerpColor(color(255, 255, 255), color(255, 200, 220), t * 3);
  } else if (t < 0.66) {
    return lerpColor(color(255, 200, 220), color(255, 100, 180), (t - 0.33) * 3);
  } else {
    return lerpColor(color(255, 100, 180), color(100, 30, 120), (t - 0.66) * 3);
  }
}

// Hover
function drawSimpleHover() {
  if (!worldGeo) return;
  
  let mouseLon = map(mouseX, 0, width, -180, 180);
  let mouseLat = map(mouseY, 0, height, 85, -85);
  
  for (let feature of worldGeo.features) {
    if (isMouseOverCountry(mouseLon, mouseLat, feature)) {
      let countryName = feature.properties.ADMIN || feature.properties.name;
      showSimpleTooltip(countryName, mouseX + 12, mouseY + 12);
      return;
    }
  }
}

function isMouseOverCountry(lon, lat, feature) {
  let geom = feature.geometry;
  if (!geom) return false;
  
  if (geom.type === 'Polygon') {
    return checkAllRings(lon, lat, geom.coordinates);
  } else if (geom.type === 'MultiPolygon') {
    for (let polygon of geom.coordinates) {
      if (checkAllRings(lon, lat, polygon)) {
        return true;
      }
    }
  }
  return false;
}

function checkAllRings(lon, lat, polygonCoords) {
  if (polygonCoords && polygonCoords[0]) {
    return pointInPolygonSimple(lon, lat, polygonCoords[0]);
  }
  return false;
}

function pointInPolygonSimple(x, y, polygon) {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  let j = polygon.length - 1;
  
  for (let i = 0; i < polygon.length; i++) {
    let xi = polygon[i][0];
    let yi = polygon[i][1];
    let xj = polygon[j][0];
    let yj = polygon[j][1];
    
    if (yi === yj) {
      j = i;
      continue;
    }
    
    if (((yi > y) !== (yj > y))) {
      let intersectX = (xj - xi) * (y - yi) / (yj - yi) + xi;
      if (x < intersectX) {
        inside = !inside;
      }
    }
    j = i;
  }
  return inside;
}

function showSimpleTooltip(countryName, x, y) {
  textSize(12);
  textStyle(BOLD);
  let w = textWidth(countryName);
  let h = 20;
  let bx = x;
  let by = y;
  
  if (bx + w + 16 > width) bx = x - (w + 16);
  if (by + h + 8 > height) by = height - (h + 8);
  if (bx < 6) bx = 6;
  if (by < 6) by = 6;
  
  push();
  fill(0, 200);
  rect(bx, by, w + 12, h + 4, 4);
  fill(255);
  noStroke();
  textAlign(LEFT);
  text(countryName, bx + 6, by + 16);
  pop();
}

// Legenda
function drawLegend() {
  let legendX = 10;
  let legendY = height - 150;
  let legendWidth = 250;
  let legendHeight = 130;
  
  push();
  fill(0, 180);
  rect(legendX, legendY, legendWidth, legendHeight, 5);
  
  fill(255);
  textAlign(LEFT);
  textSize(14);
  textStyle(BOLD);
  text('Gender Equality Average', legendX + 15, legendY + 25);
  textStyle(NORMAL);
  
  let colorBarY = legendY + 45;
  let colorBarHeight = 20;
  let colorBarWidth = legendWidth - 30;
  
  for (let i = 0; i < colorBarWidth; i++) {
    let t = i / colorBarWidth;
    let col = getColorForAverage(t * 100);
    stroke(col);
    line(legendX + 15 + i, colorBarY, legendX + 15 + i, colorBarY + colorBarHeight);
  }
  
  textSize(11);
  fill(255);
  text('Low (0)', legendX + 15, colorBarY + colorBarHeight + 17);
  text('High (100)', legendX + legendWidth - 60, colorBarY + colorBarHeight + 17);
  
  textSize(10);
  fill(200);
  text('Click on a country to see details', legendX + 15, legendY + 110);
  pop();
}

function drawTitle() {
  let legendX = 0;
  let legendY = height - 150;
  let titleX = legendX + 15;
  
  push();
  fill(255);
  textAlign(LEFT, TOP);
  textSize(18);
  textStyle(BOLD);
  text('Gender Equality Index Explorer', titleX, legendY - 50);
  
  textSize(12);
  textStyle(NORMAL);
  fill(200);
  text('Interactive visualization of gender equality worldwide', titleX, legendY - 23);
  pop();
}

// Pannello dettaglio
function drawDetailPanel() {
  if (!selectedCountry || !selectedCountry.data) return;
  
  push();
  // Sfondo
  fill(30, 30, 30, 240);
  rect(detailPanel.x, detailPanel.y, detailPanel.width, detailPanel.height, 8);
  
  // Nome paese in alto
  noStroke();
  fill(255);
  textAlign(LEFT, TOP);
  textSize(20);
  textStyle(BOLD);
  text(selectedCountry.name, detailPanel.x + 15, detailPanel.y + 15);
  
  // Toggle buttons in alto a destra
  drawToggleButtons();
  
  // Contenuto in base alla vista
  if (detailPanel.currentView === 'info') {
    drawInfoView();
  } else {
    drawGraphView();
  }
  
  // Bottone Chiudi in basso a destra
  drawCloseButton();
  pop();
}

function drawToggleButtons() {
  let toggleWidth = 120;
  let toggleHeight = 36;
  let btnY = detailPanel.y + 10;
  let toggleX = detailPanel.x + detailPanel.width - toggleWidth - 15;
  
  push();
  // Sfondo grigio del toggle
  fill(60, 60, 60);
  noStroke();
  rect(toggleX, btnY, toggleWidth, toggleHeight, toggleHeight/2);
  
  // Bottone scorrevole (knob) - LILLA e OVALE
  let knobWidth = toggleWidth / 2 - 4;
  let knobHeight = toggleHeight - 8;
  let knobY = btnY + toggleHeight/2;
  let knobX;
  
  if (detailPanel.currentView === 'info') {
    knobX = toggleX + knobWidth/2 + 4;
  } else {
    knobX = toggleX + toggleWidth - knobWidth/2 - 4;
  }
  
  // Bottone ovale lilla
  fill(150, 100, 200);
  noStroke();
  rectMode(CENTER);
  rect(knobX, knobY, knobWidth, knobHeight, knobHeight/2);
  rectMode(CORNER);
  
  // Label "info" - bianca se selezionata, grigia se no
  textAlign(CENTER, CENTER);
  textSize(11);
  textStyle(NORMAL);
  if (detailPanel.currentView === 'info') {
    fill(255);
  } else {
    fill(120, 120, 120);
  }
  text('info', toggleX + toggleWidth/4, knobY);
  
  // Label "graph" - bianca se selezionata, grigia se no
  if (detailPanel.currentView === 'graph') {
    fill(255);
  } else {
    fill(120, 120, 120);
  }
  text('graph', toggleX + 3*toggleWidth/4, knobY);
  pop();
}

function drawCloseButton() {
  let btnWidth = 80;
  let btnHeight = 35;
  let btnX = detailPanel.x + detailPanel.width - btnWidth - 15;
  let btnY = detailPanel.y + detailPanel.height - btnHeight - 15;
  
  // Bottone con colore neutro e molto tondeggiante
  fill(80, 80, 90);
  rect(btnX, btnY, btnWidth, btnHeight, btnHeight/2);
  
  fill(220);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(13);
  textStyle(NORMAL);
  text('close', btnX + btnWidth/2, btnY + btnHeight/2);
}

function drawInfoView() {
  let data = selectedCountry.data;
  let centerX = detailPanel.x + detailPanel.width/2;
  let centerY = detailPanel.y + 220;
  
  push();
  translate(centerX, centerY);
  
  let boundsData = getCountryBounds(selectedCountry.feature);
  if (boundsData) {
    // Calcola i bounds di TUTTI i poligoni insieme (principale + isole)
    let globalBounds = {
      minLon: Infinity,
      maxLon: -Infinity,
      minLat: Infinity,
      maxLat: -Infinity
    };
    
    // Trova i bounds globali includendo tutte le isole
    for (let polygon of boundsData.allPolygons) {
      let polyBounds = getPolygonBounds(polygon);
      globalBounds.minLon = min(globalBounds.minLon, polyBounds.minLon);
      globalBounds.maxLon = max(globalBounds.maxLon, polyBounds.maxLon);
      globalBounds.minLat = min(globalBounds.minLat, polyBounds.minLat);
      globalBounds.maxLat = max(globalBounds.maxLat, polyBounds.maxLat);
    }
    
    let lonRange = globalBounds.maxLon - globalBounds.minLon;
    let latRange = globalBounds.maxLat - globalBounds.minLat;
    
    // Determina se il paese ha isole significative
    let hasIslands = boundsData.islands.length > 0;
    
    // GESTIONE SEPARATA PER PAESI CON E SENZA ISOLE
    let maxWidth, maxHeight, strokeW;
    
    if (hasIslands) {
      // Paesi con isole - visualizzazione più ampia
      maxWidth = 270;
      maxHeight = 270;
      strokeW = 0.5;
    } else {
      // Paesi senza isole - visualizzazione più grande e dettagliata
      maxWidth = 180;
      maxHeight = 180;
      strokeW = 1;
    }
    
    // Scala basata su TUTTI i territori
    let scaleX = maxWidth / lonRange;
    let scaleY = maxHeight / latRange;
    let scale = min(scaleX, scaleY);
    
    // Offset per centrare tutto
    let offsetX = -(globalBounds.minLon + globalBounds.maxLon) / 2;
    let offsetY = -(globalBounds.minLat + globalBounds.maxLat) / 2;
    
    fill(getColorForAverage(data.average));
    stroke(255);
    strokeWeight(strokeW);
    
    // Disegna TUTTI i poligoni (principale + isole) con la stessa scala
    for (let polygon of boundsData.allPolygons) {
      drawScaledPolygon(polygon, offsetX, offsetY, scale);
    }
  }
  pop();
  
  // Coordinate sotto
  noStroke();
  fill(200);
  textAlign(CENTER, TOP);
  textSize(14);
  textStyle(NORMAL);
  text('Latitude: ' + data.latitude.toFixed(2) + '°', centerX, centerY + 180);
  text('Longitude: ' + data.longitude.toFixed(2) + '°', centerX, centerY + 205);
}

function drawGraphView() {
  let data = selectedCountry.data;
  
  // Score sotto il nome
  noStroke();
  fill(200);
  textAlign(LEFT, TOP);
  textSize(12);
  textStyle(NORMAL);
  text('Score: ' + data.average.toFixed(1), detailPanel.x + 15, detailPanel.y + 45);
  
  // Glifo a petali
  let glyphX = detailPanel.x + detailPanel.width/2;
  let glyphY = detailPanel.y + 220;
  drawDetailedGlyph(data, glyphX, glyphY);
  
  // Legenda sotto
  drawIndicatorsLegend(detailPanel.x + 15, detailPanel.y + 360);
}

function getCountryBounds(feature) {
  if (!feature || !feature.geometry) return null;
  
  let geom = feature.geometry;
  let coords = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  
  // Trova il poligono più grande (territorio principale)
  let largestPolygon = null;
  let maxArea = 0;
  let largestIndex = 0;
  
  for (let i = 0; i < coords.length; i++) {
    let area = calculatePolygonArea(coords[i][0]);
    if (area > maxArea) {
      maxArea = area;
      largestPolygon = coords[i];
      largestIndex = i;
    }
  }
  
  if (!largestPolygon) {
    largestPolygon = coords[0];
  }
  
  // Calcola bounds del territorio principale
  let mainBounds = getPolygonBounds(largestPolygon);
  
  // Raccogli tutte le isole secondarie
  let islands = [];
  for (let i = 0; i < coords.length; i++) {
    if (i !== largestIndex) {
      islands.push(coords[i]);
    }
  }
  
  return {
    mainBounds: mainBounds,
    mainPolygon: largestPolygon,
    islands: islands,
    allPolygons: coords
  };
}

function getPolygonBounds(polygon) {
  let minLon = Infinity, maxLon = -Infinity;
  let minLat = Infinity, maxLat = -Infinity;
  
  for (let ring of polygon) {
    for (let point of ring) {
      minLon = min(minLon, point[0]);
      maxLon = max(maxLon, point[0]);
      minLat = min(minLat, point[1]);
      maxLat = max(maxLat, point[1]);
    }
  }
  
  return {minLon, maxLon, minLat, maxLat};
}

function calculatePolygonArea(ring) {
  if (!ring || ring.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    area += (ring[i][0] * ring[i + 1][1]) - (ring[i + 1][0] * ring[i][1]);
  }
  return Math.abs(area / 2);
}

function drawScaledPolygon(coordArray, offsetX, offsetY, scale) {
  beginShape();
  for (let ring of coordArray) {
    for (let c of ring) {
      let x = (c[0] + offsetX) * scale;
      let y = -(c[1] + offsetY) * scale;
      vertex(x, y);
    }
  }
  endShape(CLOSE);
}

function drawDetailedGlyph(data, centerX, centerY) {
  push();
  translate(centerX, centerY);
  
  let maxPetalLength = 90;
  let angleStep = TWO_PI / indicators.length;
  
  // Cerchi guida
  noFill();
  stroke(100, 100, 100, 80);
  strokeWeight(1);
  for (let i = 1; i <= 4; i++) {
    let r = (maxPetalLength / 4) * i;
    ellipse(0, 0, r * 2, r * 2);
  }
  
  // Etichette percentuali
  fill(150);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(9);
  text('25', maxPetalLength/4, -5);
  text('50', maxPetalLength/2, -5);
  text('75', maxPetalLength*0.75, -5);
  text('100', maxPetalLength, -5);
  
  // Petali
  for (let i = 0; i < indicators.length; i++) {
    let indicator = indicators[i];
    let value = data.indicators[indicator];
    let petalLength = map(value, 0, 100, 0, maxPetalLength);
    let angle = i * angleStep - HALF_PI;
    
    fill(colors[indicator]);
    stroke(255);
    strokeWeight(2);
    beginShape();
    vertex(0, 0);
    let x1 = cos(angle - angleStep / 4) * petalLength * 0.7;
    let y1 = sin(angle - angleStep / 4) * petalLength * 0.7;
    vertex(x1, y1);
    let x2 = cos(angle) * petalLength;
    let y2 = sin(angle) * petalLength;
    vertex(x2, y2);
    let x3 = cos(angle + angleStep / 4) * petalLength * 0.7;
    let y3 = sin(angle + angleStep / 4) * petalLength * 0.7;
    vertex(x3, y3);
    endShape(CLOSE);
    
    // Valore sul petalo
    let labelDist = petalLength + 15;
    let labelX = cos(angle) * labelDist;
    let labelY = sin(angle) * labelDist;
    fill(colors[indicator]);
    noStroke();
    ellipse(labelX, labelY, 18, 18);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(9);
    textStyle(BOLD);
    text(value.toFixed(0), labelX, labelY);
  }
  
  // Cerchio centrale
  fill(255);
  stroke(30);
  strokeWeight(3);
  ellipse(0, 0, 40, 40);
  fill(30);
  noStroke();
  textAlign(CENTER, CENTER);
  textSize(14);
  textStyle(BOLD);
  text(data.average.toFixed(1), 0, -3);
  textSize(8);
  textStyle(NORMAL);
  text('AVG', 0, 10);
  
  pop();
}

function drawIndicatorsLegend(x, y) {
  textAlign(LEFT, TOP);
  textSize(10);
  textStyle(NORMAL);
  
  let col1 = [];
  let col2 = [];
  for (let i = 0; i < indicators.length; i++) {
    if (i < 6) {
      col1.push(indicators[i]);
    } else {
      col2.push(indicators[i]);
    }
  }
  
  // Colonna 1
  for (let i = 0; i < col1.length; i++) {
    fill(colors[col1[i]]);
    noStroke();
    rect(x, y + i * 16, 8, 8, 2);
    noStroke();
    fill(200);
    text(col1[i], x + 12, y + i * 16);
  }
  
  // Colonna 2
  let col2X = x + 210;
  for (let i = 0; i < col2.length; i++) {
    fill(colors[col2[i]]);
    noStroke();
    rect(col2X, y + i * 16, 8, 8, 2);
    noStroke();
    fill(200);
    text(col2[i], col2X + 12, y + i * 16);
  }
}

// INTERAZIONI
function mousePressed() {
  if (detailPanel.open) {
    // Click sul bottone Chiudi
    let btnWidth = 80;
    let btnHeight = 35;
    let btnX = detailPanel.x + detailPanel.width - btnWidth - 15;
    let btnY = detailPanel.y + detailPanel.height - btnHeight - 15;
    
    if (mouseX >= btnX && mouseX <= btnX + btnWidth &&
        mouseY >= btnY && mouseY <= btnY + btnHeight) {
      detailPanel.open = false;
      selectedCountry = null;
      return;
    }
    
    // Click sul toggle
    let toggleWidth = 120;
    let toggleHeight = 36;
    let btnYPos = detailPanel.y + 10;
    let toggleX = detailPanel.x + detailPanel.width - toggleWidth - 15;
    
    if (mouseX >= toggleX && mouseX <= toggleX + toggleWidth &&
        mouseY >= btnYPos && mouseY <= btnYPos + toggleHeight) {
      detailPanel.currentView = detailPanel.currentView === 'info' ? 'graph' : 'info';
      return;
    }
    
    // Drag del pannello
    if (mouseX >= detailPanel.x && mouseX <= detailPanel.x + detailPanel.width &&
        mouseY >= detailPanel.y && mouseY <= detailPanel.y + detailPanel.height) {
      isDragging = true;
      dragOffsetX = mouseX - detailPanel.x;
      dragOffsetY = mouseY - detailPanel.y;
      return;
    }
  }
  
  openCountryPanel();
}

function openCountryPanel() {
  if (!worldGeo) return;
  
  let mouseLon = map(mouseX, 0, width, -180, 180);
  let mouseLat = map(mouseY, 0, height, 85, -85);
  
  let foundCountry = null;
  for (let feature of worldGeo.features) {
    if (isMouseOverCountry(mouseLon, mouseLat, feature)) {
      foundCountry = feature;
      break;
    }
  }
  
  if (!foundCountry) return;
  
  let geoName = foundCountry.properties.ADMIN || foundCountry.properties.name;
  let countryData = null;
  
  for (let country of allCountries) {
    if (country.country.toLowerCase() === geoName.toLowerCase() ||
        geoName.toLowerCase().includes(country.country.toLowerCase()) ||
        country.country.toLowerCase().includes(geoName.toLowerCase())) {
      countryData = country;
      break;
    }
  }
  
  if (countryData) {
    selectedCountry = {
      name: countryData.country,
      data: countryData,
      feature: foundCountry
    };
    
    if (!detailPanel.open) {
      detailPanel.x = width - detailPanel.width - 20;
      detailPanel.y = 20;
      detailPanel.currentView = 'info';
    }
    detailPanel.open = true;
  }
}

function mouseDragged() {
  if (isDragging && detailPanel.open) {
    detailPanel.x = mouseX - dragOffsetX;
    detailPanel.y = mouseY - dragOffsetY;
    detailPanel.x = constrain(detailPanel.x, 0, width - detailPanel.width);
    detailPanel.y = constrain(detailPanel.y, 0, height - detailPanel.height);
  }
}

function mouseReleased() {
  isDragging = false;
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}