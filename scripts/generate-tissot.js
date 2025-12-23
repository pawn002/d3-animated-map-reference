#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const turf = require('@turf/turf');

// Simple CLI parsing
const argv = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = argv.indexOf(name);
  if (idx === -1) return fallback;
  return argv[idx + 1];
}

const radiusKm = Number(getArg('--radius', getArg('-r', '1000')));
const outPath = getArg(
  '--out',
  getArg('-o', `src/app/components/map-container/sampleData/tissot_${radiusKm}km_20deg.json`)
);
const lonStep = Number(getArg('--lon-step', '20'));
const latStep = Number(getArg('--lat-step', '20'));
const latMin = Number(getArg('--lat-min', '-80'));
const latMax = Number(getArg('--lat-max', '80'));

const features = [];

for (let lat = latMin; lat <= latMax; lat += latStep) {
  for (let lon = -180; lon < 180; lon += lonStep) {
    const center = [lon, lat];
    const circle = turf.circle(center, radiusKm, { steps: 128, units: 'kilometers' });
    circle.properties = circle.properties || {};
    circle.properties.center = center;
    circle.properties.radius_km = radiusKm;
    features.push(circle);
  }
}

const fc = turf.featureCollection(features);

// Normalize longitudes to [-180, 180] to avoid large wrapped polygons across the dateline
function normalizeLon(lon) {
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return lon;
}

function normalizeCoords(obj) {
  if (!obj || !obj.type) return;
  if (obj.type === 'FeatureCollection') {
    obj.features.forEach(normalizeCoords);
    return;
  }
  if (obj.type === 'Feature') obj = obj.geometry;
  if (obj.type === 'Polygon') {
    obj.coordinates = obj.coordinates.map((ring) =>
      ring.map(([lon, lat]) => [normalizeLon(lon), lat])
    );
  } else if (obj.type === 'MultiPolygon') {
    obj.coordinates = obj.coordinates.map((poly) =>
      poly.map((ring) => ring.map(([lon, lat]) => [normalizeLon(lon), lat]))
    );
  }
}

normalizeCoords(fc);

// Ensure output directory exists
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(outPath, JSON.stringify(fc, null, 2), 'utf8');
console.log(`Wrote ${features.length} circles to ${outPath} (radius ${radiusKm} km)`);
