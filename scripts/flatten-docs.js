/**
 * Post-build script for GitHub Pages: flattens docs/browser/ into docs/
 * and creates .nojekyll. Cross-platform (no shell commands needed).
 */
const fs = require('fs');
const path = require('path');

const docsDir = path.join(__dirname, '..', 'docs');
const browserDir = path.join(docsDir, 'browser');

// Copy everything from docs/browser/ up to docs/
for (const file of fs.readdirSync(browserDir)) {
  fs.cpSync(path.join(browserDir, file), path.join(docsDir, file), { recursive: true });
}

// Clean up build artifacts
fs.rmSync(browserDir, { recursive: true, force: true });
for (const name of ['prerendered-routes.json', '3rdpartylicenses.txt']) {
  const p = path.join(docsDir, name);
  if (fs.existsSync(p)) fs.rmSync(p);
}

// Create .nojekyll so GitHub Pages doesn't ignore _ prefixed files
fs.writeFileSync(path.join(docsDir, '.nojekyll'), '');

console.log('docs/ flattened for GitHub Pages');
