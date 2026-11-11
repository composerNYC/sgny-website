#!/usr/bin/env node
/*
SGNY weekly email builder. It turns a week file (emails/weeks/<date>/week.json) into the email HTML.

  node scripts/email-builder.mjs next "<subject>"  start emails/weeks/<date>/week.json from the latest week
  node scripts/email-builder.mjs videos            latest uploads on the SGNY YouTube channel
  node scripts/email-builder.mjs <week.json>       build a preview page: emails/weeks/<date>/preview.html
                                                   (all images embedded, for the approval preview)

Uploading and putting the email into Mailchimp is done by: node scripts/mailchimp.mjs fill <draft-id> <week.json>

The look comes from emails/layout.html and emails/blocks/ (taken from the Nov 9, 2026 email).
week.json format: see .claude/skills/weekly-email/SKILL.md.
*/

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const emailsDir = join(root, 'emails');
const cacheDir = join(emailsDir, '.cache');
const read = (p) => readFileSync(join(emailsDir, p), 'utf8');

const LINK_STYLE = 'word-wrap: break-word;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;color: #606060;font-weight: normal;text-decoration: underline;';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Sunday 11:00am study group: rotates by which Sunday of the month it is.
// Keep in sync with src/data/activities.js (the website schedule).
const SUNDAY_ROTATION = {
  1: { title: 'Study Group - Sex and Destiny', text: 'We resume our study of the book "Sex and Destiny", by Francisco C. Xavier, Waldo Vieira and Andre Luiz (Spirit).' },
  2: { title: 'Study Group - The Gospel According to Spiritism', text: 'We resume our study of "The Gospel According to Spiritism", by Allan Kardec.' },
  3: { title: "Study Group - The Mediums' Book", text: 'We resume our study of "The Mediums\' Book", by Allan Kardec.' },
  4: { title: 'Q&A Session', text: 'Our monthly Q&A Session for all topics in Spiritism. Feel free to bring all of your questions and commentaries.' },
};

export class BuildError extends Error {}
const fail = (msg) => { throw new BuildError(msg); };

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function loadWeek(weekPath) {
  const path = resolve(weekPath);
  if (!existsSync(path)) fail(`No week file at ${weekPath}`);
  let week;
  try { week = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(`week.json is not valid JSON: ${e.message}`); }
  if (!week.subject) fail('week.json needs a "subject".');
  if (!Array.isArray(week.content) || !week.content.length) fail('week.json needs a "content" list.');
  return { week, path, dir: dirname(path) };
}

export function saveWeek({ week, path }) {
  writeFileSync(path, JSON.stringify(week, null, 2) + '\n');
}

// "🔵 Weekly Schedule (November 16, 2026)" → Date (local, noon)
export function subjectDate(subject) {
  const m = subject.match(/\(([A-Z][a-z]+) (\d{1,2})(?:st|nd|rd|th)?, (\d{4})\)\s*$/);
  if (!m || !MONTHS.includes(m[1])) fail(`Subject must end with a date like "(November 16, 2026)": ${subject}`);
  const d = new Date(Number(m[3]), MONTHS.indexOf(m[1]), Number(m[2]), 12);
  if (d.getDate() !== Number(m[2])) fail(`${m[1]} ${m[2]}, ${m[3]} is not a real date. Check the subject.`);
  return d;
}

const fmtDate = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

// The Sunday shown in the schedule: the first Sunday on or after the subject date.
export function sundayFor(week) {
  const d = subjectDate(week.subject);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const nth = Math.ceil(d.getDate() / 7);
  if (week.sunday === 'none') return { date: fmtDate(d), nth, none: true };
  const info = week.sunday || SUNDAY_ROTATION[nth];
  if (week.sunday && (typeof week.sunday !== 'object' || !week.sunday.title || !week.sunday.text)) {
    fail('"sunday" must be "none" or have both a "title" and a "text".');
  }
  if (!info) fail(`${fmtDate(d)} is a 5th Sunday, which has no regular session. Ask what happens that day and set "sunday" in week.json ({"title": ..., "text": ...} or "none").`);
  return { date: fmtDate(d), nth, ...info };
}

// Light formatting for Claude-written text: blank line = new paragraph, line break kept,
// <a href> gets the email's blue link style. Allowed tags: a, strong, b, em, i, u, br.
function formatText(text) {
  // A "<" that doesn't start a tag is just a character (e.g. "ages < 12"). A bare ">" is fine as is.
  text = text.replace(/<(?![a-zA-Z/])/g, '&lt;');
  const bad = text.match(/<(?!\/?(a|strong|b|em|i|u|br)\b)[^>]+>/i);
  if (bad) fail(`Text uses an unsupported tag ${bad[0]}. Use plain text with blank lines, and only <a>, <strong>, <em>, <u>, <br>.`);
  const plainA = text.match(/<a\b(?![^>]*href=")[^>]*>/i);
  if (plainA) fail(`Link written as ${plainA[0]}: write links as <a href="https://...">text</a>.`);
  return text.trim()
    .replace(/\r/g, '')
    .replace(/<a\b[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) =>
      `<a href="${href}" target="_blank" style="${LINK_STYLE}"><span style="color:#0000FF">${label}</span></a>`)
    .replace(/\n{2,}/g, '<br>\n<br>\n')
    .replace(/(?<!<br>)\n(?!<br>)/g, '<br>\n');
}

function textBlock(item) {
  const align = item.align || 'justify';
  const size = item.size || 14;
  const inner = `<div style="text-align: ${align};"><span style="font-size:${size}px">${formatText(item.text)}</span></div>`;
  return read('blocks/parts/text.html').replace('{{TEXT}}', () => inner);
}

// ---------- images ----------
const isUrl = (s) => /^https?:\/\//.test(s);
const uploadedUrl = (entry) => (typeof entry === 'string' ? entry : entry?.url);

// Gmail cuts off emails over ~102 KB (hiding the end, including the unsubscribe link).
// Drop indentation and inline styles that the <head> CSS already sets for every element,
// plus empty <font> wrappers left behind by a browser translation tool.
function compact(html) {
  return html
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;/g, '')
    .replace(/mso-table-lspace: 0pt;mso-table-rspace: 0pt;/g, '')
    .replace(/<\/?font\b[^>]*>/g, (() => {
      const stack = []; // for each open <font>: drop it (and its matching </font>)?
      return (tag) => {
        if (tag[1] !== '/') { const drop = tag === '<font style="vertical-align: inherit;">'; stack.push(drop); return drop ? '' : tag; }
        return stack.pop() ? '' : tag;
      };
    })());
}
// Gmail's cut-off is ~102 KB of what arrives; Mailchimp's click-tracking makes every link longer, so keep headroom.
export const GMAIL_LIMIT = 90_000;

function sips(args) { return execFileSync('sips', args, { encoding: 'utf8' }); }
function pixelSize(file) {
  const out = sips(['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  return { w: Number(out.match(/pixelWidth: (\d+)/)[1]), h: Number(out.match(/pixelHeight: (\d+)/)[1]) };
}

// EXIF orientation of a JPEG: { value, offset } (offset = where the value is stored), or null.
function jpegOrientation(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let p = 2;
  while (p + 4 < buf.length && buf[p] === 0xff) {
    const marker = buf[p + 1], len = buf.readUInt16BE(p + 2);
    if (marker === 0xe1 && buf.toString('latin1', p + 4, p + 10) === 'Exif\0\0') {
      const t = p + 10, le = buf.toString('latin1', t, t + 2) === 'II';
      const u16 = (o) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
      const u32 = (o) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
      const ifd = t + u32(t + 4);
      for (let i = 0, n = u16(ifd); i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (u16(e) === 0x0112) return { value: u16(e + 8), offset: e + 8, le };
      }
      return null;
    }
    if (marker === 0xda) break;
    p += 2 + len;
  }
  return null;
}

// Phones store photos sideways plus a "rotate me" tag that some mail apps ignore.
// Turn the pixels upright and reset the tag so every app shows it the same way.
function makeUpright(file) {
  if (!/\.jpe?g$/i.test(file)) return;
  const buf = readFileSync(file);
  const o = jpegOrientation(buf);
  if (!o || o.value === 1) return;
  const deg = { 3: 180, 6: 90, 8: 270 }[o.value];
  if (!deg) fail(`${basename(file)} is stored mirrored (orientation ${o.value}). Open it in Preview, rotate it, save, and try again.`);
  sips(['--rotate', String(deg), file, '--out', file]);
  const after = readFileSync(file);
  const o2 = jpegOrientation(after);
  if (o2 && o2.value !== 1) {
    if (o2.le) after.writeUInt16LE(1, o2.offset); else after.writeUInt16BE(1, o2.offset);
    writeFileSync(file, after);
  }
}

// Make an email-ready copy of a local photo: JPEG or PNG, at most `maxW` pixels wide, upright.
function prepareImage(src, outDir, maxW) {
  if (!existsSync(src)) fail(`Image not found: ${src}`);
  mkdirSync(outDir, { recursive: true });
  const ext = extname(src).toLowerCase();
  const keepPng = ext === '.png' || ext === '.gif';
  const st = statSync(src);
  const id = createHash('sha1').update(`v2:${src}:${st.size}:${st.mtimeMs}:${maxW}`).digest('hex').slice(0, 10);
  const out = join(outDir, `${basename(src, extname(src)).replace(/[^\w-]+/g, '-')}-${id}${keepPng ? ext : '.jpg'}`);
  if (!existsSync(out)) {
    if (ext === '.gif') { writeFileSync(out, readFileSync(src)); return out; } // keep animation
    const args = ['-s', 'format', keepPng ? 'png' : 'jpeg'];
    if (!keepPng) args.push('-s', 'formatOptions', '85');
    sips([...args, src, '--out', out]);
    makeUpright(out);
    if (pixelSize(out).w > maxW) sips(['--resampleWidth', String(maxW), out, '--out', out]);
  }
  return out;
}

// Shown at most 564px wide (the email's column); smaller pictures at their own size, never stretched.
function imageBlock(item, src, pixelWidth) {
  const width = item.width || Math.min(564, pixelWidth || 564);
  let img = `<img align="center" alt="${esc(item.alt || '')}" src="${src}" width="${width}" style="max-width: 1128px;padding-bottom: 0;display: inline !important;vertical-align: bottom;border: 0;outline: none;text-decoration: none;-ms-interpolation-mode: bicubic;" class="mcnImage">`;
  if (item.link) img = `<a href="${item.link}" title="" class="" target="_blank" style="word-wrap: break-word;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;">\n${img}\n</a>`;
  return read('blocks/parts/image.html').replace('{{IMG}}', () => img);
}

// ---------- the build ----------
/*
  mode 'preview'  : every image (local and Mailchimp-hosted) embedded as data, merge tags filled in.
  mode 'mailchimp': local photos uploaded with opts.upload(file) → url, cached in week.uploaded.
*/
export async function build(weekPath, { mode = 'preview', upload } = {}) {
  const ctx = loadWeek(weekPath);
  const { week, dir } = ctx;
  const warnings = [];
  const parts = [];
  week.uploaded ||= {};

  const sunday = sundayFor(week);
  const videos = week.videos || [];
  if (!videos.length) warnings.push('No YouTube videos listed ("videos"). The "latest videos" list will be empty.');

  for (const [i, item] of week.content.entries()) {
    if (item === '---') { parts.push(read('blocks/parts/divider.html')); continue; }
    if (typeof item === 'string' && item.startsWith('@')) {
      const name = item.slice(1);
      if (!existsSync(join(emailsDir, 'blocks', name + '.html'))) fail(`Unknown standing block "${item}". Available: see emails/blocks/.`);
      let h = read(`blocks/${name}.html`);
      if (name === 'youtube') {
        const list = videos.map((v, n) =>
          `\t<li style="text-align: left;-ms-text-size-adjust: 100%;-webkit-text-size-adjust: 100%;"><a href="${esc(v.url)}" target="_blank" style="${LINK_STYLE}"><span style="color:#0000FF">${esc(v.title)}</span></a>${n === videos.length - 1 ? '.' : ';'}</li>`).join('\n');
        h = h.replace('{{VIDEOS}}', () => list);
      }
      if (name === 'schedule') {
        const line = sunday.none ? '</span>' : read('blocks/parts/sunday.html')
          .replace('{{DATE}}', () => sunday.date).replace('{{TITLE}}', () => esc(sunday.title)).replace('{{TEXT}}', () => esc(sunday.text)).trimEnd();
        h = h.replace('{{SUNDAY}}', () => line);
      }
      parts.push(h);
      continue;
    }
    if (item && typeof item === 'object' && item.image) {
      if (!item.alt) warnings.push(`Item ${i + 1} (${item.image}): no "alt" text (shown when images are blocked).`);
      if (isUrl(item.image)) { parts.push(imageBlock(item, item.image)); continue; }
      const src = resolve(dir, item.image);
      const ready = prepareImage(src, join(dir, '.build'), 1128);
      const w = pixelSize(ready).w;
      if (w < 564 && !item.width) warnings.push(`Item ${i + 1} (${item.image}) is only ${w}px wide, so it will show smaller than the other pictures (or set "width").`);
      let url;
      if (mode === 'mailchimp') {
        const key = `${item.image}:${statSync(src).size}`;
        if (!week.uploaded[key]) {
          week.uploaded[key] = { url: await upload(ready), width: Math.min(564, w) };
          saveWeek(ctx);
        }
        url = uploadedUrl(week.uploaded[key]);
      } else {
        url = 'file://' + ready; // embedded later
      }
      parts.push(imageBlock(item, url, w));
      continue;
    }
    if (item && typeof item === 'object' && typeof item.text === 'string') { parts.push(textBlock(item)); continue; }
    fail(`Item ${i + 1} in "content" isn't understood: ${JSON.stringify(item).slice(0, 80)}`);
  }

  let html = compact(read('layout.html').replace('{{CONTENT}}', () => parts.join('\n')));
  const size = Buffer.byteLength(html);
  if (size > GMAIL_LIMIT) warnings.push(`The email is ${Math.round(size / 1000)} KB; Gmail cuts off emails over about 102 KB. Shorten it (drop an older announcement).`);

  // Safety checks on the finished email.
  if (!html.includes('*|UNSUB|*')) fail('The email has no unsubscribe link (*|UNSUB|*). Mailchimp requires one.');
  if (/list-manage\.com\/(track|profile)/.test(html)) fail('The email contains a Mailchimp tracking or profile link copied from someone\'s inbox. Replace it with the real web address.');
  for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
    if (!/^(https?:|mailto:|tel:|\*\|)/.test(href)) warnings.push(`Odd link: ${href}`);
  }
  if (/\b(TODO|TBD|XXX|lorem)\b/i.test(html.replace(/<[^>]+>/g, ' '))) warnings.push('The text contains TODO/TBD/XXX/lorem.');

  if (mode === 'preview') html = await embedForPreview(html, week);
  return { html, week, sunday, warnings, dir };
}

// ---------- preview ----------
function fetchCached(url) {
  mkdirSync(cacheDir, { recursive: true });
  const file = join(cacheDir, createHash('sha1').update(url).digest('hex').slice(0, 16) + (extname(new URL(url).pathname) || '.img'));
  if (!existsSync(file)) {
    const tmp = file + '.part';
    try { execFileSync('curl', ['-sSfL', '--max-time', '60', '-o', tmp, url]); } catch { fail(`Couldn't download ${url} for the preview. Check the internet connection and try again.`); }
    renameSync(tmp, file); // only keep complete downloads
  }
  return file;
}

async function embedForPreview(html, week) {
  const year = String(new Date().getFullYear());
  html = html
    .replace(/\*\|MC:SUBJECT\|\*/g, esc(week.subject))
    .replace(/\*\|MC_PREVIEW_TEXT\|\*/g, esc(week.previewText || ''))
    .replace(/\*\|CURRENT_YEAR\|\*/g, year)
    .replace(/\*\|(IF|END):[^|]*\|\*/g, '')
    .replace(/\*\|EMAIL\|\*/g, 'subscriber@example.com')
    .replace(/href="\*\|[A-Z_:]+\|\*"/g, 'href="#"')
    .replace(/\*\|[A-Z_:]+\|\*/g, '');
  const srcs = [...new Set([...html.matchAll(/src="((?:https?|file):\/\/[^"]+)"/g)].map((m) => m[1]))];
  for (const src of srcs) {
    let file = src.startsWith('file://') ? src.slice(7) : fetchCached(src);
    // Smaller copy just for the preview page.
    const small = prepareImage(file, join(cacheDir, 'preview'), 800);
    const type = small.endsWith('.png') ? 'image/png' : small.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
    html = html.split(`src="${src}"`).join(`src="data:${type};base64,${readFileSync(small).toString('base64')}"`);
  }
  return html;
}

// Start next week's file from the latest week: same list of items, new subject.
// Local photos that were uploaded become their Mailchimp links (the files stay in the old folder).
export function nextWeek(subject) {
  const d = subjectDate(subject);
  const folder = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const weeksDir = join(emailsDir, 'weeks');
  const target = join(weeksDir, folder, 'week.json');
  if (existsSync(target)) fail(`${target} already exists. Edit that one instead.`);
  const prevName = execFileSync('ls', [weeksDir], { encoding: 'utf8' }).split('\n')
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n) && n < folder && existsSync(join(weeksDir, n, 'week.json'))).sort().pop();
  if (!prevName) fail('No earlier week found in emails/weeks/.');
  const { week: prev, dir: prevDir } = loadWeek(join(weeksDir, prevName, 'week.json'));
  const dropped = [];
  const content = prev.content.flatMap((item) => {
    if (!item?.image || isUrl(item.image)) return [item];
    // Prefer the upload of the exact file; if the file is gone (another Mac, tidied folder), use any upload of that name.
    const src = resolve(prevDir, item.image);
    const up = prev.uploaded || {};
    const exact = existsSync(src) && up[`${item.image}:${statSync(src).size}`];
    const byName = Object.keys(up).filter((k) => k.slice(0, k.lastIndexOf(':')) === item.image).map((k) => up[k]).pop();
    const entry = exact || byName;
    if (!entry) { dropped.push(item.image); return []; } // never went out in an email
    return [{ ...item, image: uploadedUrl(entry), ...(item.width || entry.width ? { width: item.width || entry.width } : {}) }];
  });
  const week = { subject, content, videos: [] };
  if (prev.previewText) week.previewText = prev.previewText.replace(/\([^)]*\)/, `(${fmtDate(d)})`);
  mkdirSync(join(weeksDir, folder), { recursive: true });
  saveWeek({ week, path: target });
  return { path: target, from: prevName, dropped };
}

// Latest uploads on the SGNY YouTube channel (newest first).
export async function latestVideos(n = 6) {
  let xml;
  try {
    const res = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=UC8IaYwI9obGOFko2kwXQb8A');
    if (!res.ok) throw new Error(String(res.status));
    xml = await res.text();
  } catch { fail("Couldn't reach YouTube. Check the internet connection, or ask Joao for the two video links."); }
  const unxml = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].slice(0, n).map(([, e]) => ({
    title: unxml(e.match(/<title>([^<]*)<\/title>/)[1]),
    url: `https://www.youtube.com/watch?v=${e.match(/<yt:videoId>([^<]+)</)[1]}`,
    published: e.match(/<published>([^<]+)</)[1],
  }));
}

// ---------- CLI ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'next' || process.argv[2] === 'videos') {
    try {
      if (process.argv[2] === 'videos') {
        const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
        for (const v of await latestVideos()) console.log(`${fmt.format(new Date(v.published)).padEnd(12)} ${v.title}\n             ${v.url}`);
        process.exit(0);
      }
      const { path, from, dropped } = nextWeek(process.argv.slice(3).join(' ').trim());
      console.log(`✓ Started ${path} (copied from ${from}). Now update this week's items and videos.`);
      if (dropped.length) console.log(`⚠ Left out (never sent to Mailchimp last week): ${dropped.join(', ')}`);
    } catch (e) {
      if (e instanceof BuildError) { console.error('\n✗ ' + e.message + '\n'); process.exit(1); }
      throw e;
    }
    process.exit(0);
  }
  const weekPath = process.argv[2];
  if (!weekPath) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n/*', '')); process.exit(0); }
  try {
    const { html, week, sunday, warnings, dir } = await build(weekPath, { mode: 'preview' });
    const out = join(dir, 'preview.html');
    writeFileSync(out, html);
    console.log(`subject:  ${week.subject}`);
    console.log(`sunday:   ${sunday.none ? `${sunday.date}: no Sunday session` : `${sunday.date} (Sunday #${sunday.nth}): ${sunday.title}`}`);
    console.log(`videos:   ${(week.videos || []).map((v) => v.title).join(' | ') || '(none)'}`);
    console.log(`preview:  ${out} (${(html.length / 1e6).toFixed(1)} MB)`);
    for (const w of warnings) console.log(`⚠ ${w}`);
  } catch (e) {
    if (e instanceof BuildError) { console.error('\n✗ ' + e.message + '\n'); process.exit(1); }
    throw e;
  }
}
