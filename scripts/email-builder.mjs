#!/usr/bin/env node
/*
SGNY weekly email builder. It turns a week file (emails/weeks/<date>/week.json) into the email HTML,
in the same look as sgny.org (colors, type, cards, schedule).

  node scripts/email-builder.mjs next "<subject>"     start emails/weeks/<date>/week.json from the latest week
  node scripts/email-builder.mjs videos               latest uploads on the SGNY YouTube channel
  node scripts/email-builder.mjs options <week.json>  side-by-side choices from <week folder>/options.json → options.html
  node scripts/email-builder.mjs <week.json>          build a preview page: emails/weeks/<date>/preview.html
  node scripts/email-builder.mjs publish <week.json>  after sending: save the web version for sgny.org/weekly-news
                                                      (src/data/weekly-news/<date>.json; no Zoom details, no unsubscribe footer)

Uploading and putting the email into Mailchimp is done by: node scripts/mailchimp.mjs fill <draft-id> <week.json>

Where things come from:
  - the weekly schedule: src/data/activities.js (the website's schedule, so both always agree)
  - books, promotions, Zoom, quote, links: emails/standing.json
  - this week's events, videos and choices: week.json (format: .claude/skills/weekly-email/SKILL.md)
*/

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, renameSync, readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, resolve, basename, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const emailsDir = join(root, 'emails');
const cacheDir = join(emailsDir, '.cache');
const standing = () => JSON.parse(readFileSync(join(emailsDir, 'standing.json'), 'utf8'));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export class BuildError extends Error {}
const fail = (msg) => { throw new BuildError(msg); };
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ---------- the website's look (same tokens as src/styles/global.css) ----------
const C = {
  ink: '#1c2430', soft: '#4a5568', bg: '#f4f1ea', paper: '#fbfaf7', white: '#ffffff', line: '#e7e2d8',
  brand: '#1f4e79', brandDark: '#163a5c', gold: '#c08a2d', goldText: '#2a1d05', goldSoft: '#f3ead6', pill: '#efe9dd',
};
const SERIF = `'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif`;
const SANS = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const COL = 520; // width of the content column (600 minus side padding)

// ---------- week file ----------
export function loadWeek(weekPath) {
  const path = resolve(weekPath);
  if (!existsSync(path)) fail(`No week file at ${weekPath}`);
  let week;
  try { week = JSON.parse(readFileSync(path, 'utf8')); } catch (e) { fail(`week.json is not valid JSON: ${e.message}`); }
  if (!week.subject) fail('week.json needs a "subject".');
  if (week.content) fail('This week file uses the old format ("content"). Start the week again with "next".');
  for (const k of ['events', 'books', 'more', 'videos']) if (week[k] !== undefined && !Array.isArray(week[k])) fail(`"${k}" must be a list.`);
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

// ---------- the schedule, from the website ----------
async function websiteSessions() {
  const mod = await import(pathToFileURL(join(root, 'src/data/activities.js')).href);
  return mod.sessions;
}

// The Sunday shown: the first Sunday on or after the subject date, with that month's rotating session.
export async function sundayFor(week) {
  const d = subjectDate(week.subject);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const nth = Math.ceil(d.getDate() / 7);
  const base = { date: fmtDate(d), shortDate: `${MONTHS[d.getMonth()]} ${d.getDate()}`, nth };
  if (week.sunday === 'none') return { ...base, none: true };
  if (week.sunday) {
    if (typeof week.sunday !== 'object' || !week.sunday.title || !week.sunday.text) fail('"sunday" must be "none" or have both a "title" and a "text".');
    return { ...base, session: { time: week.sunday.time || '11:00 AM – 12:30 PM', name: week.sunday.title, mode: week.sunday.mode || 'online', tags: [], format: week.sunday.text } };
  }
  const ord = ['', '1st', '2nd', '3rd', '4th'][nth];
  const session = ord && (await websiteSessions()).find((s) => s.day === 'Sunday' && s.tags.includes(`${ord} Sunday only`));
  if (!session) fail(`${fmtDate(d)} is a 5th Sunday, which has no regular session. Ask what happens that day and set "sunday" in week.json ({"title": ..., "text": ...} or "none").`);
  return { ...base, session };
}

// ---------- small building blocks ----------
const eyebrow = (t, color = C.gold, align = 'left') =>
  `<div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${color};text-align:${align};margin:0 0 8px;">${t}</div>`;
const h2 = (t, align = 'left') =>
  `<div style="font-family:${SERIF};font-size:28px;line-height:1.2;font-weight:600;color:${C.ink};text-align:${align};margin:0 0 10px;">${t}</div>`;
const para = (t, extra = '') => `<div style="font-family:${SANS};font-size:16px;line-height:1.6;color:${C.soft};margin:0 0 12px;${extra}">${t}</div>`;
const link = (href, t, color = C.brand) => `<a href="${esc(href)}" target="_blank" style="color:${color};text-decoration:underline;">${t}</a>`;
const btn = (href, t, kind = 'gold') => {
  const s = { gold: `background:${C.gold};color:${C.goldText};border:1px solid ${C.gold};`,
    blue: `background:${C.brand};color:#ffffff;border:1px solid ${C.brand};`,
    ghost: 'background:transparent;color:#ffffff;border:1px solid rgba(255,255,255,.6);',
    outline: `background:${C.white};color:${C.brand};border:1px solid ${C.line};` }[kind];
  return `<a href="${esc(href)}" target="_blank" style="${s}display:inline-block;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;text-decoration:none;padding:13px 20px;border-radius:10px;margin:4px 8px 4px 0;">${esc(t)}</a>`;
};
const pill = (t) => `<span style="display:inline-block;font-family:${SANS};font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:${C.soft};background:${C.pill};border-radius:4px;padding:3px 7px;margin:4px 4px 0 0;">${esc(t)}</span>`;
const section = (inner, bg = C.paper, pad = '36px 40px') => `<tr><td class="pad" style="background:${bg};padding:${pad};">${inner}</td></tr>`;
const card = (inner, extra = '') =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.white};border:1px solid ${C.line};border-radius:14px;border-collapse:separate;${extra}"><tr><td style="padding:0;">${inner}</td></tr></table>`;
const img = (src, alt, w, radius = 12, href) => {
  const i = `<img src="${src}" alt="${esc(alt || '')}" width="${w}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;border-radius:${radius}px;margin:0 auto;">`;
  return href ? `<a href="${esc(href)}" target="_blank">${i}</a>` : i;
};

// Claude-written text: blank line = new paragraph, line break kept. Allowed tags: a, strong, b, em, i, u, br.
function formatText(text, linkColor = C.brand) {
  text = String(text).replace(/<(?![a-zA-Z/])/g, '&lt;');
  const bad = text.match(/<(?!\/?(a|strong|b|em|i|u|br)\b)[^>]+>/i);
  if (bad) fail(`Text uses an unsupported tag ${bad[0]}. Use plain text with blank lines, and only <a>, <strong>, <em>, <u>, <br>.`);
  const plainA = text.match(/<a\b(?![^>]*href=")[^>]*>/i);
  if (plainA) fail(`Link written as ${plainA[0]}: write links as <a href="https://...">text</a>.`);
  return text.trim().replace(/\r/g, '')
    .replace(/<a\b[^>]*?href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => link(href, label, linkColor))
    .replace(/<strong>/g, `<strong style="color:${C.ink};">`)
    .replace(/\n{2,}/g, '<br><br>')
    .replace(/\n/g, '<br>');
}

// ---------- images ----------
const isUrl = (s) => /^https?:\/\//.test(s);
const uploadedUrl = (entry) => (typeof entry === 'string' ? entry : entry?.url);
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

// A picture from week.json (local file or https link) → { src, width } ready for the email.
// Local files: preview mode points at the prepared file; mailchimp mode uploads it (once).
async function picture(image, opts, what) {
  const { ctx, mode, upload, warnings } = opts;
  const { week, dir } = ctx;
  if (isUrl(image)) {
    const known = Object.values(week.uploaded || {}).find((e) => uploadedUrl(e) === image);
    return { src: image, width: known?.width || null };
  }
  const file = resolve(dir, image);
  if (mode === 'web') {
    // The website shows the copy already uploaded to Mailchimp (published only after the email is sent).
    const up = week.uploaded || {};
    const exact = existsSync(file) && up[`${image}:${statSync(file).size}`];
    const entry = exact || Object.keys(up).filter((k) => k.slice(0, k.lastIndexOf(':')) === image).map((k) => up[k]).pop();
    if (!entry) fail(`${what} (${image}) isn't in Mailchimp yet. Put the email in Mailchimp ("fill") before publishing it to the website.`);
    return { src: uploadedUrl(entry), width: entry.width || COL };
  }
  const ready = prepareImage(file, join(dir, '.build'), COL * 2);
  const w = pixelSize(ready).w;
  if (w < COL) warnings.push(`${what} (${image}) is only ${w}px wide, so it will show smaller than the column or look soft.`);
  const width = Math.min(COL, w);
  if (mode !== 'mailchimp') return { src: 'file://' + ready, width };
  week.uploaded ||= {};
  const key = `${image}:${statSync(file).size}`;
  if (!week.uploaded[key]) {
    week.uploaded[key] = { url: await upload(ready), width };
    saveWeek(ctx);
  }
  return { src: uploadedUrl(week.uploaded[key]), width };
}

// ---------- sections ----------
function header(L) {
  return `
<tr><td class="pad" style="background:${C.paper};padding:18px 40px;border-bottom:1px solid ${C.line};">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:12px;vertical-align:middle;"><a href="${L.website}" target="_blank"><img src="${L.logo}" width="44" height="44" alt="SGNY" style="display:block;border:0;border-radius:9px;"></a></td>
    <td style="vertical-align:middle;">
      <div style="font-family:${SERIF};font-size:19px;font-weight:600;color:${C.ink};line-height:1.2;">Spiritist Group of New York <span style="font-family:${SANS};font-size:9px;font-weight:700;letter-spacing:1.5px;color:${C.soft};vertical-align:middle;">EST. 2001</span></div>
      <div style="font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:1.6px;text-transform:uppercase;color:${C.soft};margin-top:3px;">Allan Kardec · Spiritism</div>
    </td>
  </tr></table>
</td></tr>`;
}

function hero(week, S) {
  const d = subjectDate(week.subject);
  return `
<tr><td class="pad" bgcolor="${C.brand}" style="background-color:${C.brand};background-image:linear-gradient(180deg,#0097d8 0%,#2d368f 100%);padding:44px 40px 40px;">
  ${eyebrow('This week at SGNY', '#f0c66a')}
  <div style="font-family:${SERIF};font-size:36px;line-height:1.15;font-weight:600;color:#ffffff;margin:0 0 14px;">Week of ${MONTHS[d.getMonth()]}&nbsp;${d.getDate()}, ${d.getFullYear()}</div>
  <div style="font-family:${SANS};font-size:17px;line-height:1.6;color:#e4eef8;margin:0 0 22px;">${formatText(week.intro || S.intro, '#ffffff')}</div>
  ${btn(S.links.schedule, 'See the full schedule')}${btn(S.links.youtube, 'Watch on YouTube', 'ghost')}
</td></tr>`;
}

// One item of "Happening soon": a flyer (image + caption), a card (title/text/buttons), or a short note.
async function eventItem(item, i, opts) {
  const what = `Event ${i + 1}`;
  if (!item || typeof item !== 'object') fail(`${what} isn't understood: ${JSON.stringify(item).slice(0, 80)}`);
  if (item.title) return cardItem(item, opts, what);
  if (item.image) {
    if (!item.alt) opts.warnings.push(`${what} (${item.image}): no "alt" text (shown when images are blocked).`);
    const p = await picture(item.image, opts, what);
    const cap = item.caption ? `<div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${C.soft};text-align:center;margin:12px 0 0;">${formatText(item.caption)}</div>` : '';
    return `<div style="margin:0 0 26px;">${img(p.src, item.alt, item.width || p.width || COL, 12, item.link)}${cap}</div>`;
  }
  if (typeof item.text === 'string') {
    return `<div style="font-family:${SANS};font-size:${item.size || 16}px;line-height:1.6;color:${C.ink};text-align:${item.align || 'center'};margin:0 0 22px;">${formatText(item.text)}</div>`;
  }
  fail(`${what} needs an "image", a "title" or a "text".`);
}

async function cardItem(c, opts, what) {
  let pic = '';
  if (c.image) { const p = await picture(c.image, opts, what); pic = img(p.src, c.alt || c.title, 518, 0); }
  const buttons = (c.buttons || []).map((b) => btn(b.url, b.label, 'outline')).join('');
  return `${card(`${pic}
    <div style="padding:22px 24px 20px;">
      ${c.label ? eyebrow(esc(c.label)) : ''}
      <div style="font-family:${SERIF};font-size:22px;font-weight:600;line-height:1.25;color:${C.ink};margin:0 0 8px;">${esc(c.title)}</div>
      ${c.text ? para(formatText(c.text), 'font-size:15px;') : ''}
      ${buttons}
    </div>`, 'overflow:hidden;')}<div style="height:20px;line-height:20px;font-size:0;">&nbsp;</div>`;
}

async function bookCell(b, opts, what) {
  const p = await picture(b.image, opts, what);
  return `<td class="col" width="50%" valign="top" style="padding:0 8px;">
    ${img(p.src, b.title, 240, 10, b.link)}
    <div style="font-family:${SERIF};font-size:18px;font-weight:600;line-height:1.25;color:${C.ink};margin:14px 0 4px;">${esc(b.title)}</div>
    <div style="font-family:${SANS};font-size:13px;color:${C.soft};margin:0 0 8px;">${esc(b.by || '')}</div>
    <div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${C.soft};margin:0 0 10px;">${formatText(b.text || '')}</div>
    <a href="${esc(b.link)}" target="_blank" style="font-family:${SANS};font-size:14px;font-weight:600;color:${C.gold};text-decoration:none;">Get the book &rarr;</a>
  </td>`;
}

// A name from standing.json, or an object written in week.json.
function lookup(kind, entry, S) {
  if (typeof entry === 'string') {
    const found = S[kind]?.[entry];
    if (!found) fail(`Unknown ${kind === 'books' ? 'book' : 'promotion'} "${entry}". Known: ${Object.keys(S[kind] || {}).join(', ')}.`);
    return found;
  }
  return entry;
}

function session(s, S, dateOverride) {
  const mode = { 'in-person': 'In person', online: 'Online', hybrid: 'Hybrid' }[s.mode] || s.mode;
  const tags = [mode, ...(s.tags || []).filter((t) => !/Sunday only$/.test(t))];
  // "Study Group" + material “The Spirits’ Book” → "Study Group: The Spirits’ Book"
  const bookTitle = (s.material || '').match(/[“"]([^”"]+?)[,]?[”"]/)?.[1];
  const name = s.name === 'Study Group' && bookTitle ? `${s.name}: ${bookTitle}` : s.name;
  const desc = s.day === 'Wednesday' && s.material ? `Current book: ${s.material}` : (s.format || '');
  const bookName = Object.keys(S.bookLinks || {}).find((b) => `${s.material || ''} ${s.format || ''}`.includes(b));
  const get = bookName ? `<a href="${esc(S.bookLinks[bookName])}" target="_blank" style="display:inline-block;font-family:${SANS};font-size:13px;font-weight:600;color:${C.gold};text-decoration:none;margin-top:6px;">Get the book &rarr;</a>` : '';
  return `
  <tr><td style="padding:14px 18px;border-top:1px solid ${C.line};">
    <div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:1px;color:${C.gold};">${esc(s.time)}</div>
    <div style="font-family:${SERIF};font-size:18px;color:${C.ink};line-height:1.3;margin:2px 0 2px;">${esc(name)}</div>
    <div>${tags.map(pill).join('')}</div>
    ${desc ? `<div style="font-family:${SANS};font-size:14px;line-height:1.55;color:${C.soft};margin:8px 0 0;">${esc(desc)}</div>` : ''}
    ${get}
  </td></tr>`;
}
const dayBox = (name, rows) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.white};border:1px solid ${C.line};border-radius:14px;margin:0 0 16px;border-collapse:separate;">
    <tr><td style="background:${C.brand};border-radius:13px 13px 0 0;padding:11px 18px;font-family:${SERIF};font-size:18px;color:#ffffff;">${name}</td></tr>
    ${rows.join('')}
  </table>`;

async function schedule(week, S, sunday) {
  const all = (await websiteSessions()).filter((s) => !/closed/i.test(s.audience || '') && s.day !== 'Sunday');
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const boxes = days.map((d) => [d, all.filter((s) => s.day === d)]).filter(([, l]) => l.length)
    .map(([d, l]) => dayBox(d, l.map((s) => session(s, S))));
  if (!sunday.none) boxes.push(dayBox(`Sunday, ${sunday.shortDate}`, [session({ ...sunday.session, day: 'Sunday' }, S)]));
  return section(`
  ${eyebrow('Join us', C.soft, 'center')}
  ${h2('This week at SGNY', 'center')}
  ${para('All activities are free and open to all. Times are Eastern.', 'text-align:center;')}
  <div style="height:14px;line-height:14px;font-size:0;">&nbsp;</div>
  ${boxes.join('')}`);
}

// The Zoom link, ID, password and phone come from the website, the same master link every session page uses.
async function zoomBox(S, web) {
  if (web) {
    // The website keeps the Zoom details out of its pages (they're decoded only when a visitor opens a session).
    return section(card(`<div style="padding:24px;">
    ${eyebrow('Join online')}
    <div style="font-family:${SERIF};font-size:22px;font-weight:600;color:${C.ink};margin:0 0 10px;">All online meetings use one Zoom link</div>
    ${para('Open any session in our schedule to get the link and password.', 'font-size:15px;')}
    ${btn(S.links.schedule, 'Open the schedule', 'blue')}
    </div>`, `background:${C.goldSoft};border-color:${C.goldSoft};`), C.white, '8px 40px 36px');
  }
  const z = (await import(pathToFileURL(join(root, 'src/data/activities.js')).href)).zoom;
  if (!z?.url || !z?.id) fail('The website has no Zoom details (zoom in src/data/activities.js).');
  return section(card(`<div style="padding:24px;">
    ${eyebrow('Join online')}
    <div style="font-family:${SERIF};font-size:22px;font-weight:600;color:${C.ink};margin:0 0 10px;">All online meetings use one Zoom link</div>
    ${btn(z.url, 'Join on Zoom', 'blue')}
    <div style="font-family:${SANS};font-size:14px;line-height:1.7;color:${C.soft};margin-top:12px;">
      Meeting ID <strong style="color:${C.ink};">${esc(z.id)}</strong>${z.password ? ` · Password <strong style="color:${C.ink};">${esc(z.password)}</strong>` : ''}<br>
      ${z.phone ? `By phone: ${esc(z.phone)}, then enter the Meeting ID.<br>` : ''}
      ${S.zoom?.localNumbers ? `Other numbers: ${link(S.zoom.localNumbers, 'find your local number')}.` : ''}
    </div></div>`, `background:${C.goldSoft};border-color:${C.goldSoft};`), C.white, '8px 40px 36px');
}

function videosBox(week, S, warnings) {
  const videos = week.videos || [];
  if (!videos.length) warnings.push('No YouTube videos listed ("videos"). The "Latest videos" list will be empty.');
  const rows = videos.map((v) => {
    const [series, ...rest] = String(v.title).split(': ');
    const title = rest.length ? rest.join(': ') : series;
    return `
    <tr>
      <td width="46" valign="middle" style="padding:12px 0;border-top:1px solid ${C.line};">
        <a href="${esc(v.url)}" target="_blank" style="display:block;width:34px;height:34px;line-height:34px;text-align:center;border-radius:17px;background:${C.goldSoft};color:${C.brandDark};font-size:13px;text-decoration:none;">&#9654;</a>
      </td>
      <td valign="middle" style="padding:12px 0;border-top:1px solid ${C.line};">
        <a href="${esc(v.url)}" target="_blank" style="text-decoration:none;">${rest.length ? `<span style="font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:${C.gold};">${esc(series)}</span><br>` : ''}<span style="font-family:${SERIF};font-size:18px;color:${C.ink};">${esc(title)}</span></a>
      </td>
    </tr>`;
  }).join('');
  return section(`
  ${eyebrow('Watch &amp; learn')}
  ${h2('Latest videos')}
  ${para('Catch up on this week\'s study groups:')}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">${rows}</table>
  ${btn(S.links.youtube, 'Visit our YouTube channel')}`, C.white);
}

function donateBox(S) {
  return section(`
  ${eyebrow('Support SGNY', C.gold, 'center')}
  ${h2('Help keep our doors open', 'center')}
  ${para('All our activities are free. A recurring donation, of any size, helps us sustain our programs and plan for the year ahead.', 'text-align:center;')}
  <div style="text-align:center;margin:16px 0 10px;">${btn(S.links.donate, 'Make a donation')}</div>
  ${para(`You can also give through Zelle to <strong style="color:${C.ink};">${esc(S.links.zelle)}</strong>.`, 'text-align:center;font-size:14px;')}`);
}

function quoteBox(q) {
  return section(`
  <div style="text-align:center;">
    <div style="width:40px;border-top:2px solid ${C.gold};margin:0 auto 18px;font-size:0;line-height:0;">&nbsp;</div>
    <div style="font-family:${SERIF};font-style:italic;font-size:22px;line-height:1.45;color:${C.ink};">“${esc(q.text)}”</div>
    <div style="font-family:${SANS};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:${C.soft};margin-top:14px;">${esc(q.by)}</div>
  </div>`, C.white, '40px 48px');
}

function footer(L) {
  const fl = (href, t) => `<a href="${href}" target="_blank" style="color:#dbe6f1;text-decoration:none;font-weight:600;">${t}</a>`;
  return `
<tr><td class="pad" style="background:${C.ink};padding:34px 40px 28px;">
  <div style="font-family:${SERIF};font-size:18px;color:#ffffff;margin:0 0 6px;">Spiritist Group of New York</div>
  <div style="font-family:${SANS};font-size:13px;line-height:1.7;color:#c6cfdb;">939 Eighth Avenue, Suite 409 · New York, NY 10019</div>
  <div style="font-family:${SANS};font-size:13px;line-height:1.9;color:#c6cfdb;margin:12px 0 18px;">
    ${fl(L.website, 'Website')} &nbsp;·&nbsp; ${fl(L.youtube, 'YouTube')} &nbsp;·&nbsp; ${fl(L.facebook, 'Facebook')} &nbsp;·&nbsp; ${fl(L.email, 'Email us')}
  </div>
  <div style="border-top:1px solid #34404f;font-size:0;line-height:0;margin:0 0 16px;">&nbsp;</div>
  <div style="font-family:${SANS};font-size:12px;line-height:1.6;color:#9aa6b4;">
    You are receiving this email because you signed up for updates from SGNY. This email was sent to *|EMAIL|*.<br>
    <a href="*|UNSUB|*" style="color:#c6cfdb;">Unsubscribe</a> &nbsp;·&nbsp; <a href="*|UPDATE_PROFILE|*" style="color:#c6cfdb;">Update your preferences</a> &nbsp;·&nbsp; <a href="*|ABOUT_LIST|*" style="color:#c6cfdb;">Why did I get this?</a>
  </div>
  <div style="font-family:${SANS};font-size:11px;line-height:1.6;color:#7f8b99;margin-top:16px;">
    <strong>Legal disclaimer.</strong> The Spiritist Group of New York ("SGNY") is a not-for-profit organization with the main goal of promoting and disseminating the Spiritist philosophy according to the teachings of Allan Kardec. The SGNY does not charge for any of its services or activities; its members, associates and/or volunteers do not receive any type of compensation for their services. Revenue from the sales of books, magazines, videos, and audios is entirely used to cover SGNY's expenses. The views expressed in the books, magazines, videos, and audios sold, recommended and/or referred to by SGNY members, associates and/or volunteers belong to their authors, and those views do not necessarily represent the views of the SGNY or of any of its members, associates and/or volunteers. The SGNY does not promise or guarantee physical, spiritual, emotional, and/or mental healing, cure or improvement to attendees, their relatives or acquaintances. Although the Spiritist philosophy advocates the possibility of physical, spiritual, emotional and/or mental healing, cure or improvement through its study and practice, it also advocates the causational complexity of suffering and illness, and of their solution. Therefore, SGNY recommends to attendees, their relatives or acquaintances who seek physical, spiritual, emotional and/or mental healing, cure or improvement not to disregard, interrupt and/or abandon ongoing and/or future traditional methods of treatment.
  </div>
  <div style="font-family:${SANS};font-size:11px;color:#7f8b99;margin-top:14px;">© *|CURRENT_YEAR|* Spiritist Group of New York. *|LIST:ADDRESSLINE|*</div>
  <div style="margin-top:14px;">*|REWARDS|*</div>
</td></tr>`;
}

function page(rows) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>*|MC:SUBJECT|*</title>
<style>
  body { margin:0; padding:0; background:${C.bg}; }
  a { color:${C.brand}; }
  @media only screen and (max-width:620px) {
    .pad { padding-left:20px !important; padding-right:20px !important; }
    .col { display:block !important; width:100% !important; padding:0 0 28px !important; }
  }
</style></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;">*|MC_PREVIEW_TEXT|*</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border-radius:16px;overflow:hidden;border:1px solid ${C.line};">
${rows.join('\n')}
</table>
</td></tr></table>
</body></html>`;
}

// ---------- the build ----------
/*
  mode 'preview'  : every image (local and hosted) embedded as data, merge tags filled in.
  mode 'mailchimp': local photos uploaded with opts.upload(file) → url, remembered in week.uploaded.
*/
export async function build(weekPath, { mode = 'preview', upload } = {}) {
  const ctx = loadWeek(weekPath);
  const { week, dir } = ctx;
  const S = standing();
  const warnings = [];
  const opts = { ctx, mode, upload, warnings };
  const sunday = await sundayFor(week);

  const web = mode === 'web';
  const rows = web ? [] : [header(S.links), hero(week, S)]; // the website page has its own header and banner

  const events = week.events || [];
  if (events.length) {
    const items = [];
    for (const [i, e] of events.entries()) items.push(await eventItem(e, i, opts));
    rows.push(section(`${eyebrow('Happening soon')}${h2('Upcoming events')}<div style="height:10px;line-height:10px;font-size:0;">&nbsp;</div>${items.join('')}`));
  }

  const books = (week.books || []).map((b) => lookup('books', b, S));
  if (books.length) {
    const cells = [];
    for (const [i, b] of books.entries()) cells.push(await bookCell(b, opts, `Book ${i + 1}`));
    const tableRows = [];
    for (let i = 0; i < cells.length; i += 2) tableRows.push(`<tr>${cells[i]}${cells[i + 1] || '<td class="col" width="50%">&nbsp;</td>'}</tr>`);
    rows.push(section(`
  ${eyebrow('From our catalog', C.gold, 'center')}
  ${h2('New in English', 'center')}
  ${para('Published and distributed at cost by the Spiritist Alliance for Books.', 'text-align:center;')}
  <div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${tableRows.join('')}</table>`, C.white));
  }

  const more = (week.more || []).map((m) => lookup('cards', m, S));
  if (more.length) {
    const cards = [];
    for (const [i, m] of more.entries()) cards.push(await cardItem(m, opts, `Promotion ${i + 1}`));
    rows.push(section(`${eyebrow('Read · Learn · Listen')}${h2('More from our community')}<div style="height:12px;line-height:12px;font-size:0;">&nbsp;</div>${cards.join('')}`));
  }

  rows.push(videosBox(week, S, warnings));
  rows.push(await schedule(week, S, sunday));
  rows.push(await zoomBox(S, web));
  rows.push(donateBox(S));
  rows.push(quoteBox(week.quote || S.quote));

  if (web) {
    // For the website's Weekly News page: just the email's column (the site has its own header and footer).
    const html = `<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" class="wn-mail" style="width:100%;max-width:600px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid ${C.line};">\n${rows.join('\n')}\n</table>`;
    if (/zoom\.us\/j\//.test(html)) fail('The web version contains the Zoom link; it must stay off the website.');
    if (/\*\|[A-Z_:]+\|\*/.test(html)) fail('The web version still has a Mailchimp merge tag in it.');
    return { html, week, sunday, warnings, dir };
  }
  rows.push(footer(S.links));

  let html = page(rows);
  const size = Buffer.byteLength(html);
  if (size > GMAIL_LIMIT) warnings.push(`The email is ${Math.round(size / 1000)} KB; Gmail cuts off emails over about 102 KB. Shorten it (drop an older announcement).`);
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
  html = html
    .replace(/\*\|MC:SUBJECT\|\*/g, esc(week.subject))
    .replace(/\*\|MC_PREVIEW_TEXT\|\*/g, esc(week.previewText || ''))
    .replace(/\*\|CURRENT_YEAR\|\*/g, String(new Date().getFullYear()))
    .replace(/\*\|(IF|END):[^|]*\|\*/g, '')
    .replace(/\*\|EMAIL\|\*/g, 'subscriber@example.com')
    .replace(/href="\*\|[A-Z_:]+\|\*"/g, 'href="#"')
    .replace(/\*\|[A-Z_:]+\|\*/g, '');
  const srcs = [...new Set([...html.matchAll(/src="((?:https?|file):\/\/[^"]+)"/g)].map((m) => m[1]))];
  for (const src of srcs) {
    const file = src.startsWith('file://') ? src.slice(7) : fetchCached(src);
    const small = prepareImage(file, join(cacheDir, 'preview'), 900); // smaller copy just for the preview page
    const type = small.endsWith('.png') ? 'image/png' : small.endsWith('.gif') ? 'image/gif' : 'image/jpeg';
    html = html.split(`src="${src}"`).join(`src="data:${type};base64,${readFileSync(small).toString('base64')}"`);
  }
  return html;
}

// ---------- options page ----------
/*
  <week folder>/options.json:
  { "question": "How should we announce Rafael Rezende's talk?",
    "options": [ { "label": "Flyer + short invitation", "note": "optional one line", "events": [ ...event items... ] }, ... ] }
  Builds <week folder>/options.html: the options side by side, each exactly as it would look in the email.
*/
export async function buildOptions(weekPath) {
  const ctx = loadWeek(weekPath);
  const { week, dir } = ctx;
  const optPath = join(dir, 'options.json');
  if (!existsSync(optPath)) fail(`No options.json in ${dir}.`);
  let spec;
  try { spec = JSON.parse(readFileSync(optPath, 'utf8')); } catch (e) { fail(`options.json is not valid JSON: ${e.message}`); }
  if (!Array.isArray(spec.options) || spec.options.length < 2 || spec.options.length > 4) fail('options.json needs 2 to 4 "options".');
  const warnings = [];
  const opts = { ctx, mode: 'preview', warnings };
  const cols = [];
  for (const [n, opt] of spec.options.entries()) {
    const items = opt.events || opt.content;
    if (!Array.isArray(items) || !items.length) fail(`Option ${n + 1} has no "events".`);
    const parts = [];
    for (const [i, e] of items.entries()) if (e !== '---') parts.push(await eventItem(e, i, opts));
    const letter = 'ABCD'[n];
    cols.push(`<section class="opt" aria-labelledby="opt-${letter}">
<div class="opt-head"><span class="letter" id="opt-${letter}">${letter}</span><div><div class="opt-label">${esc(opt.label || `Option ${letter}`)}</div>${opt.note ? `<div class="opt-note">${esc(opt.note)}</div>` : ''}</div></div>
<div class="mail"><div class="mail-inner">${parts.join('\n')}</div></div>
</section>`);
  }
  const html = await embedForPreview(`<meta charset="utf-8">
<title>${esc(spec.title || `Email options, ${week.subject.match(/\(([^)]+)\)/)?.[1] || ''}`)}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Page around the email samples. Layout: one column per option, wrapping to a single column on phones. */
:root { --bg: #f4f1ea; --fg: #1c2430; --muted: #4a5568; --card: #ffffff; --line: #e7e2d8; --accent: #1f4e79; --onaccent: #ffffff; --mailbg: #fbfaf7; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #12161c; --fg: #e8ecf1; --muted: #a3afbd; --card: #1b2128; --line: #2d3742; --accent: #6fa8dc; --onaccent: #0e1520; color-scheme: dark; } }
:root[data-theme="dark"] { --bg: #12161c; --fg: #e8ecf1; --muted: #a3afbd; --card: #1b2128; --line: #2d3742; --accent: #6fa8dc; --onaccent: #0e1520; color-scheme: dark; }
body { background: var(--bg); color: var(--fg); font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; margin: 0;
  padding-block: 24px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
.intro { max-width: 1900px; margin: 0 auto 20px; }
.intro .q { font-family: Georgia, serif; font-size: 24px; font-weight: 600; line-height: 1.3; text-wrap: balance; margin: 0 0 6px; }
.intro .how { color: var(--muted); font-size: 15px; margin: 0; }
.grid { display: flex; flex-wrap: wrap; gap: 24px; justify-content: center; align-items: flex-start; max-width: 1900px; margin: 0 auto; }
.opt { flex: 1 1 340px; max-width: 620px; min-width: 0; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 14px; }
.opt-head { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
.letter { flex: none; width: 40px; height: 40px; border-radius: 50%; background: var(--accent); color: var(--onaccent); font-weight: 700; font-size: 20px; display: grid; place-items: center; }
.opt-label { font-weight: 650; font-size: 17px; }
.opt-note { color: var(--muted); font-size: 14px; margin-top: 2px; }
.mail { background: var(--mailbg); border-radius: 10px; padding: 24px 20px 4px; overflow-x: auto; }
.mail-inner { max-width: 520px; margin: 0 auto; }
.mail-inner img { max-width: 100% !important; height: auto; }
</style>
<div class="intro"><p class="q">${esc(spec.question || 'Which one do you like best?')}</p>
<p class="how">Each one shows exactly how it will look in the email. Tell Claude the letter you like, or what to change.</p></div>
<div class="grid">${cols.join('\n')}</div>`, week);
  const out = join(dir, 'options.html');
  writeFileSync(out, html);
  return { out, warnings, count: spec.options.length };
}

// ---------- next week ----------
// Start next week's file from the latest week: same events, books and promotions, new subject.
// Local photos that were uploaded become their Mailchimp links (the files stay in the old folder).
export function nextWeek(subject) {
  const d = subjectDate(subject);
  // Practice runs ("PRACTICE 🔵 Weekly Schedule (...)") get their own folder and are never used as "last week".
  const practice = /^PRACTICE\b/.test(subject);
  const folder = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}${practice ? '-practice' : ''}`;
  const weeksDir = join(emailsDir, 'weeks');
  const target = join(weeksDir, folder, 'week.json');
  if (existsSync(target)) fail(`${target} already exists. Edit that one instead.`);
  const prevName = readdirSync(weeksDir)
    .filter((n) => /^\d{4}-\d{2}-\d{2}$/.test(n) && n < folder.slice(0, 10) && existsSync(join(weeksDir, n, 'week.json'))).sort().pop();
  if (!prevName) fail('No earlier week found in emails/weeks/.');
  const { week: prev, dir: prevDir } = loadWeek(join(weeksDir, prevName, 'week.json'));
  const dropped = [];
  const up = prev.uploaded || {};
  const carry = (item) => {
    if (!item || typeof item !== 'object' || !item.image || isUrl(item.image)) return [item];
    // Prefer the upload of the exact file; if the file is gone (another Mac, tidied folder), use any upload of that name.
    const src = resolve(prevDir, item.image);
    const exact = existsSync(src) && up[`${item.image}:${statSync(src).size}`];
    const byName = Object.keys(up).filter((k) => k.slice(0, k.lastIndexOf(':')) === item.image).map((k) => up[k]).pop();
    const entry = exact || byName;
    if (!entry) { dropped.push(item.image); return []; } // never went out in an email
    return [{ ...item, image: uploadedUrl(entry) }];
  };
  const week = { subject };
  if (prev.previewText) week.previewText = prev.previewText.replace(/\([^)]*\)/, `(${fmtDate(d)})`);
  week.events = (prev.events || []).flatMap(carry);
  week.books = (prev.books || []).flatMap(carry);
  week.more = (prev.more || []).flatMap(carry);
  if (prev.quote) week.quote = prev.quote;
  week.videos = [];
  // Keep the upload records for photos carried over by link, so their sizes stay right.
  const kept = Object.fromEntries(Object.entries(up).filter(([, e]) => JSON.stringify(week).includes(uploadedUrl(e))));
  if (Object.keys(kept).length) week.uploaded = kept;
  mkdirSync(join(weeksDir, folder), { recursive: true });
  saveWeek({ week, path: target });
  return { path: target, from: prevName, dropped };
}

// ---------- website: Weekly News ----------
// After an email is sent, save its web version as src/data/weekly-news/<YYYY-MM-DD>.json.
// The site's /weekly-news page shows the newest one; each issue also gets its own page.
export async function publishWeb(weekPath) {
  const { week } = loadWeek(weekPath);
  if (/^PRACTICE\b/.test(week.subject)) fail('This is a practice email. Practice emails are never published to the website.');
  const d = subjectDate(week.subject);
  const slug = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const { html, sunday } = await build(weekPath, { mode: 'web' });
  const outDir = join(root, 'src/data/weekly-news');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, `${slug}.json`);
  const events = (week.events || []).map((e) => e.title || (e.caption || '').split('\n')[0].replace(/<[^>]+>/g, '').split(' · ')[0]).filter(Boolean);
  writeFileSync(out, JSON.stringify({
    slug, date: fmtDate(d), subject: week.subject,
    summary: events.slice(0, 3).join(' · '),
    sunday: sunday.none ? null : `${sunday.shortDate}: ${sunday.session.name}`,
    html,
  }, null, 2) + '\n');
  return { out, slug };
}

// Latest uploads on the SGNY YouTube channel (newest first). Same source as the website's Videos page:
// the RSS feed, or the channel page when the feed is down (dates then approximate).
export async function latestVideos(n = 8) {
  const { latestVideos: fetchVideos } = await import(pathToFileURL(join(root, 'src/lib/youtube.js')).href);
  const { videos, source } = await fetchVideos();
  if (!videos) fail("Couldn't reach YouTube. Check the internet connection, or ask Joao for the two video links.");
  return videos.slice(0, n).map((v) => ({ title: v.title, url: `https://www.youtube.com/watch?v=${v.id}`, published: v.date, approx: source !== 'rss' }));
}

// ---------- CLI ----------
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...args] = process.argv.slice(2);
  try {
    if (!cmd) {
      console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n/*', ''));
    } else if (cmd === 'options') {
      const { out, warnings, count } = await buildOptions(args[0] || fail('Usage: options <week.json>'));
      console.log(`options:  ${out} (${count} options)`);
      for (const w of warnings) console.log(`⚠ ${w}`);
    } else if (cmd === 'videos') {
      const fmt = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
      for (const v of await latestVideos()) console.log(`${(v.approx ? '~' : '') + fmt.format(new Date(v.published + 'T12:00:00'))}`.padEnd(13) + ` ${v.title}\n              ${v.url}`);
    } else if (cmd === 'publish') {
      const { out, slug } = await publishWeb(args[0] || fail('Usage: publish <week.json>'));
      console.log(`✓ Web version saved: ${out}\n  It appears at sgny.org/weekly-news (and /weekly-news/${slug}) once committed and pushed.`);
    } else if (cmd === 'next') {
      const { path, from, dropped } = nextWeek(args.join(' ').trim());
      console.log(`✓ Started ${path} (copied from ${from}). Now update this week's events and videos.`);
      if (dropped.length) console.log(`⚠ Left out (never sent to Mailchimp last week): ${dropped.join(', ')}`);
    } else {
      const { html, week, sunday, warnings, dir } = await build(cmd, { mode: 'preview' });
      const out = join(dir, 'preview.html');
      writeFileSync(out, html);
      console.log(`subject:  ${week.subject}`);
      console.log(`sunday:   ${sunday.none ? `${sunday.date}: no Sunday session` : `${sunday.date} (Sunday #${sunday.nth}): ${sunday.session.name}`}`);
      console.log(`videos:   ${(week.videos || []).map((v) => v.title).join(' | ') || '(none)'}`);
      console.log(`preview:  ${out} (${(html.length / 1e6).toFixed(1)} MB)`);
      for (const w of warnings) console.log(`⚠ ${w}`);
    }
  } catch (e) {
    if (e instanceof BuildError) { console.error('\n✗ ' + e.message + '\n'); process.exit(1); }
    throw e;
  }
}
