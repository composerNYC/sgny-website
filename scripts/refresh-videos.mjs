#!/usr/bin/env node
// Keep the saved video list (src/data/videos.js) up to date, so that if YouTube can't be
// reached during a build, the Spiritist Videos page falls back to recent videos, not old ones.
// Adds any new uploads to the top of `channelVideos`. Prints "changed" or "unchanged".
// Run daily by .github/workflows/videos-watch.yml.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { latestVideos } from '../src/lib/youtube.js';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/data/videos.js');
const { videos, source } = await latestVideos();
if (!videos) {
  console.log('unchanged (YouTube unreachable)');
  process.exit(0);
}
let src = readFileSync(file, 'utf8');
const head = 'export const channelVideos = [\n';
const start = src.indexOf(head);
const end = src.indexOf('];', start);
if (start < 0 || end < 0) throw new Error('channelVideos list not found in src/data/videos.js');
const body = src.slice(start + head.length, end);
const known = new Set([...body.matchAll(/id: '([^']+)'/g)].map((m) => m[1]));
const fresh = videos.filter((v) => !known.has(v.id));
if (!fresh.length) {
  console.log(`unchanged (${source})`);
  process.exit(0);
}
const lines = fresh.map((v) => `  { id: '${v.id}', title: ${JSON.stringify(v.title)}, date: "${v.date}" },\n`).join('');
src = src.slice(0, start) + head + lines + body + src.slice(end);
writeFileSync(file, src);
console.log(`changed: added ${fresh.length} (${source}): ${fresh.map((v) => v.title).join(' | ')}`);
