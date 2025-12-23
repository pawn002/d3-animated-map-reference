#!/usr/bin/env node
/**
 * Generate Tissot Indicatrix Circles
 *
 * Creates a grid of equal-radius circles for visualizing map projection distortion.
 *
 * IMPORTANT - Polygon Winding Order:
 * =================================
 * Turf.js generates circles with CLOCKWISE winding order by default, which causes
 * SVG fills to render INVERTED (filling the entire map except the circle).
 *
 * If you encounter "opaque rectangle" issues when using fills:
 * 1. The circles are likely rendering with exterior fills (inverted)
 * 2. Fix by reversing the coordinate arrays (see fixWindingOrder function below)
 *
 * To verify winding order:
 * - Render a single circle with fill (e.g., fill: 'coral', fillOpacity: 0.5)
 * - If the MAP is filled EXCEPT the circle → winding order is inverted
 * - If the CIRCLE is filled normally → winding order is correct
 *
 * See: src/app/components/map-container/sampleData/README.md for details
 */
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

/**
 * Fix polygon winding order for SVG fill rendering
 *
 * Reverses coordinate arrays to change from clockwise to counter-clockwise
 * winding order (or vice versa). This ensures SVG fills render the INTERIOR
 * of circles instead of the EXTERIOR.
 *
 * Uncomment the line below if generated circles render as inverted fills.
 */
function fixWindingOrder(featureCollection) {
  return {
    ...featureCollection,
    features: featureCollection.features.map(feature => ({
      ...feature,
      geometry: {
        ...feature.geometry,
        coordinates: feature.geometry.coordinates.map(ring => [...ring].reverse())
      }
    }))
  };
}

// Uncomment to fix winding order (if circles render with inverted fills):
// fc = fixWindingOrder(fc);

// Ensure output directory exists
const outDir = path.dirname(outPath);
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(outPath, JSON.stringify(fc, null, 2), 'utf8');
console.log(`Wrote ${features.length} circles to ${outPath} (radius ${radiusKm} km)`);
