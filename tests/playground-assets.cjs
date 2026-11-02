'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const modes = [...html.matchAll(/data-wave-mode="([^"]+)"/g)].map(match => match[1]);
const mediaRoot = html.match(/id="sound-playground" data-media-root="([^"]+)"/)[1];
const assets = JSON.parse(fs.readFileSync(path.join(root, mediaRoot, 'meshes.json'), 'utf8'));
assert.equal(modes.length, 7);
assert.equal(new Set(modes).size, modes.length);
assert.deepEqual(new Set(assets.map(asset => asset.id)), new Set(modes));
assert.equal(new Set(assets.map(asset => asset.style)).size, 4);
for (const asset of assets) {
  assert(asset.positions.length >= 9 && asset.positions.length % 3 === 0);
  assert(asset.positions.every(Number.isFinite));
  assert(asset.indices.length > 0 && asset.indices.length % 3 === 0);
  assert(asset.indices.every(i => Number.isInteger(i) && i >= 0 && i < asset.positions.length / 3));
  assert(asset.path.length >= 6 && asset.path.length % 3 === 0);
  assert(asset.path.every(Number.isFinite));
  const movie = fs.readFileSync(path.join(root, mediaRoot, `${asset.id}.m4a`));
  assert(movie.length > 1000, `${asset.id}: empty audio`);
  assert.equal(movie.toString('ascii', 4, 8), 'ftyp');
  assert(movie.indexOf('moov') >= 8 && movie.indexOf('moov') < movie.indexOf('mdat'), `${asset.id}: streaming index missing`);
  const svg = fs.readFileSync(path.join(root, mediaRoot, `${asset.id}.svg`), 'utf8');
  assert(svg.includes('<svg') && svg.includes('<polygon'), `${asset.id}: fallback missing`);
}
console.log('PASS all seven public samples, native meshes, playhead paths, and SVG fallbacks are complete');
