#!/usr/bin/env node
// Refresh the Spiritist Centers lists (src/data/spiritist-groups.json) from SpiritistGroups.org,
// a project of The Spiritist Institute. Feeds /other-spiritist-institutions/usa and
// /other-spiritist-institutions/worldwide. Run by hand now and then: node scripts/refresh-spiritist-groups.mjs
// Waits 10 seconds between requests, as the site's robots.txt asks.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'src/data/spiritist-groups.json');
const API = 'https://spiritistgroups.org/wp-json/wp/v2/job-listings';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const decode = (s) => s
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const titleCase = (s) => s.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const listings = [];
for (let page = 1; ; page++) {
  if (page > 1) await sleep(10_000);
  const res = await fetch(`${API}?per_page=100&page=${page}`, { headers: { 'User-Agent': 'SGNYDirectoryRefresh/1.0 (+https://sgny.org)' } });
  if (!res.ok) throw new Error(`SpiritistGroups.org answered ${res.status} for page ${page}`);
  listings.push(...(await res.json()));
  if (page >= Number(res.headers.get('x-wp-totalpages') || 1)) break;
}

const groups = [];
for (const l of listings) {
  const m = l.meta || {};
  const classes = l.class_list || [];
  const cat = classes.find((c) => c.startsWith('job_listing_category-'))?.slice('job_listing_category-'.length);
  // Only actual centers and study groups with a place; skip support organizations, online-only
  // listings, deactivated listings and SGNY itself.
  if (l.status !== 'publish' || m._sg_deactivated_at) continue;
  if (cat !== 'spiritist-societies' && cat !== 'study-groups') continue;
  if (!m.geolocation_country_long) continue;
  if (/sgny\.org/i.test(m._company_website || '')) continue;
  // Tags mix languages ("english", "meetings-in-spanish") with features ("online", "parking-in-street").
  const tags = classes.filter((c) => c.startsWith('job_listing_tag-')).map((c) => c.slice('job_listing_tag-'.length));
  const languages = [...new Set(tags.map((t) => t.replace(/^meetings-in-/, ''))
    .filter((t) => ['english', 'portuguese', 'spanish', 'french'].includes(t)).map(titleCase))];
  groups.push({
    name: decode(l.title.rendered).trim(),
    kind: cat === 'study-groups' ? 'Study group' : 'Spiritist society',
    address: (m._job_location || m.geolocation_formatted_address || '').trim(),
    city: m.geolocation_city || '',
    state: m.geolocation_state_long || '',
    country: m.geolocation_country_long,
    website: m._company_website || '',
    languages,
    online: m._sg_offers_virtual === '1' || tags.includes('online'),
    listing: l.link,
  });
}
groups.sort((a, b) => a.country.localeCompare(b.country) || a.state.localeCompare(b.state)
  || a.city.localeCompare(b.city) || a.name.localeCompare(b.name));

const updated = new Date().toISOString().slice(0, 10);
writeFileSync(file, JSON.stringify({ source: 'https://spiritistgroups.org/', updated, groups }, null, 2) + '\n');
console.log(`saved ${groups.length} groups (of ${listings.length} listings), updated ${updated}`);
