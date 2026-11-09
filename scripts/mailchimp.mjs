#!/usr/bin/env node
/*
SGNY weekly email — send Mailchimp campaigns on demand (designed in the Mailchimp web editor).

  npm run mail:setup                               one-time: save your Mailchimp API key (typed, hidden)
  node scripts/mailchimp.mjs setup --clipboard --email you@x.com   same, reading the key from the clipboard
  node scripts/mailchimp.mjs account               plan + audiences (checks the key works)
  node scripts/mailchimp.mjs sent [n]              last n sent emails (default 3)
  node scripts/mailchimp.mjs drafts [all]          recent "Weekly Schedule" drafts (or every draft)
  node scripts/mailchimp.mjs copy <id> "<subject>" new DRAFT copied from a sent email (nothing is sent)
  node scripts/mailchimp.mjs check <id>            Mailchimp's pre-send checklist for a draft
  node scripts/mailchimp.mjs test <id> [email...]  test copy (default: MAIL_TEST_TO from .env)
  node scripts/mailchimp.mjs send <id> --confirm   SEND TO THE WHOLE AUDIENCE (cannot be undone)

Settings live in .env (gitignored, never commit): MAILCHIMP_API_KEY, MAILCHIMP_KEY_CREATED, MAIL_TEST_TO.
Workflow rules for Claude: see CLAUDE.md. Plain-language guide: see the guide sent to Joao.
*/

import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline';
import { execFileSync } from 'node:child_process';
import { Writable } from 'node:stream';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const AUDIENCE = 'SGNY - General List'; // the only audience the weekly email may go to
const WEEKLY = /weekly schedule/i;

function readEnvFile() {
  try { return readFileSync(envPath, 'utf8'); } catch { return ''; }
}
for (const line of readEnvFile().split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

function fail(msg) { console.error('\n✗ ' + msg + '\n'); process.exit(1); }

let key, base, auth, dc;
let inSetup = false;
function useKey(k) {
  key = k.trim();
  dc = key.split('-').pop();
  base = `https://${dc}.api.mailchimp.com/3.0`;
  auth = 'Basic ' + Buffer.from(`sgny:${key}`).toString('base64');
}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(base + path, {
      method,
      headers: { Authorization: auth, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    fail("Can't reach Mailchimp. Check your internet connection and try again.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if ((res.status === 401 || res.status === 403) && inSetup) {
    fail('Mailchimp didn\'t accept that key. It was probably copied with a small mistake.\n  Select the key again carefully, copy it (Cmd+C), and retry.');
  }
  if (res.status === 401 || res.status === 403) {
    fail('Mailchimp rejected the API key (it may be wrong, deleted, or expired).\n  Copy a new key (Mailchimp → Profile → Extras → API keys) and set it up again (see CLAUDE.md, "Key setup").');
  }
  if (res.status === 404) fail('Mailchimp has no email with that id. Run "drafts" or "sent" to see the right id.');
  if (!res.ok) {
    const errs = (data.errors || []).map((e) => `  - ${e.field}: ${e.message}`).join('\n');
    fail(`Mailchimp said: ${data.title || res.status}. ${data.detail || ''}${errs ? '\n' + errs : ''}`);
  }
  return data;
}

const nyTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
const fmt = (iso) => (iso ? nyTime.format(new Date(iso)) : '—');

function describe(c) {
  const s = c.settings || {};
  const r = c.recipients || {};
  const lines = [
    `id:         ${c.id}`,
    `subject:    ${s.subject_line || '(no subject — required)'}`,
    `preview:    ${s.preview_text || '—'}`,
    `from:       ${s.from_name || '(none)'} <${s.reply_to || 'no reply-to'}>`,
    `audience:   ${r.list_name || '(none selected)'}${r.segment_text ? ' · segment: ' + r.segment_text.replace(/<[^>]+>/g, '') : ''}`,
    `recipients: ${r.recipient_count ?? 0}`,
    c.send_time ? `sent:       ${fmt(c.send_time)} (${c.emails_sent} emails)` : `created:    ${fmt(c.create_time)}`,
    `edit link:  https://${dc}.admin.mailchimp.com/campaigns/edit?id=${c.web_id}`,
  ];
  if (c.send_time && c.long_archive_url) lines.push(`view:       ${c.long_archive_url}`);
  return lines.join('\n');
}

async function lastSent() {
  const { campaigns } = await api('GET', '/campaigns?status=sent&type=regular&count=1&sort_field=send_time&sort_dir=DESC');
  return campaigns[0];
}

// ---------- setup (no key needed yet) ----------
// Two ways: interactive (npm run mail:setup, key typed hidden), or
// `setup --clipboard --email you@x.com`: reads the key from the macOS clipboard so
// Claude can run it without the key ever appearing in chat or output.
async function setup() {
  const args = process.argv.slice(3);
  const fromClipboard = args.includes('--clipboard');
  const emailArg = args[args.indexOf('--email') + 1];
  console.log('\nSGNY Mailchimp setup — this saves your API key on THIS computer only.\n');

  let k, email, rl, ask;
  if (fromClipboard) {
    try { k = execFileSync('pbpaste', { encoding: 'utf8' }); } catch { fail('Could not read the clipboard (this option needs a Mac).'); }
    k = k.trim().replace(/^"|"$/g, '');
    email = args.includes('--email') ? emailArg || '' : '';
  } else {
    let muted = false;
    const out = new Writable({ write(chunk, _e, cb) { if (!muted) process.stdout.write(chunk); cb(); } });
    rl = createInterface({ input: process.stdin, output: out, terminal: true });
    ask = (q, hide) => new Promise((res) => {
      process.stdout.write(q);
      muted = !!hide;
      rl.question('', (a) => { muted = false; if (hide) process.stdout.write('\n'); res(a.trim()); });
    });
    k = (await ask('Paste your API key (it stays hidden) and press Enter: ', true)).replace(/^"|"$/g, '');
  }
  if (!/^[0-9a-f]{32}-us\d+$/.test(k)) {
    rl?.close();
    fail(fromClipboard
      ? 'The clipboard doesn\'t contain a Mailchimp key. Copy the whole key (it ends in -us10) and try again.'
      : 'That doesn\'t look like a Mailchimp key (it should end in something like -us10). Run setup again.');
  }
  useKey(k);
  inSetup = true;
  const a = await api('GET', '/?fields=account_name');
  inSetup = false;
  console.log(`✓ Key works — connected to "${a.account_name}".`);
  if (!fromClipboard) { email = await ask('Your email address, for test emails: '); rl.close(); }

  const values = {
    MAILCHIMP_API_KEY: k,
    MAILCHIMP_KEY_CREATED: new Date().toISOString().slice(0, 10),
    ...(email.includes('@') ? { MAIL_TEST_TO: email } : {}),
  };
  let text = readEnvFile();
  for (const [name, val] of Object.entries(values)) {
    const line = `${name}="${val}"`;
    const re = new RegExp(`^\\s*${name}\\s*=.*$`, 'm');
    text = re.test(text) ? text.replace(re, line) : text + (text && !text.endsWith('\n') ? '\n' : '') + line + '\n';
  }
  writeFileSync(envPath, text);
  chmodSync(envPath, 0o600);
  console.log('✓ Saved. Keys expire after one year — put a reminder in your calendar for 11 months from today.');
  console.log('\nAll set! In VS Code, ask Claude: "Start next week\'s email".\n');
}

// ---------- main ----------
const [cmd, id, ...rest] = process.argv.slice(2);

if (cmd === 'setup') { await setup(); process.exit(0); }

if (!['account', 'sent', 'drafts', 'copy', 'check', 'test', 'send'].includes(cmd)) {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0].replace('#!/usr/bin/env node\n/*', ''));
  process.exit(cmd ? 1 : 0);
}

if (!process.env.MAILCHIMP_API_KEY || !/-us\d+$/.test(process.env.MAILCHIMP_API_KEY)) {
  fail('No Mailchimp key on this computer yet. Copy the key and set it up (see CLAUDE.md, "Key setup").');
}
useKey(process.env.MAILCHIMP_API_KEY);

const created = Date.parse(process.env.MAILCHIMP_KEY_CREATED || '');
if (created && Date.now() - created > 335 * 864e5) {
  console.log('⚠ Your Mailchimp key is about a year old and will expire soon. Copy a new one and set it up again (see CLAUDE.md, "Key setup").\n');
}

switch (cmd) {
  case 'account': {
    const a = await api('GET', '/?fields=account_name,pricing_plan_type,total_subscribers');
    const lists = await api('GET', '/lists?fields=lists.id,lists.name,lists.stats.member_count&count=20');
    console.log(`${a.account_name} · plan: ${a.pricing_plan_type}`);
    for (const l of lists.lists) console.log(`  audience: ${l.name} (${l.stats.member_count} subscribed)`);
    break;
  }
  case 'sent': {
    const n = Math.min(Number(id) || 3, 20);
    const { campaigns } = await api('GET', `/campaigns?status=sent&type=regular&count=${n}&sort_field=send_time&sort_dir=DESC`);
    for (const c of campaigns) console.log(describe(c) + '\n');
    break;
  }
  case 'drafts': {
    const all = id === 'all';
    const { campaigns } = await api('GET', '/campaigns?status=save&type=regular&count=100&sort_field=create_time&sort_dir=DESC');
    const cutoff = Date.now() - 60 * 864e5;
    const shown = all ? campaigns : campaigns.filter((c) =>
      WEEKLY.test(`${c.settings.subject_line} ${c.settings.title}`) && Date.parse(c.create_time) > cutoff);
    if (!shown.length) console.log('No recent "Weekly Schedule" drafts. (Start one with "copy".)');
    for (const c of shown) console.log(describe(c) + '\n');
    if (!all && campaigns.length > shown.length) console.log(`(${campaigns.length - shown.length} older or unrelated drafts hidden — "drafts all" shows them)`);
    break;
  }
  case 'copy': {
    const subject = rest.join(' ').trim();
    if (!id || !subject) fail('Usage: copy <id-of-last-sent-email> "🔵 Weekly Schedule (November 16, 2026)"');
    const copy = await api('POST', `/campaigns/${id}/actions/replicate`);
    const s = copy.settings;
    const newDate = subject.match(/\(([^)]+)\)\s*$/)?.[1];
    const preview = newDate && s.preview_text ? s.preview_text.replace(/\([^)]*\)/, `(${newDate})`) : s.preview_text;
    const updated = await api('PATCH', `/campaigns/${copy.id}`, {
      settings: { subject_line: subject, title: subject.replace(/^[^\p{L}\p{N}]+/u, '').trim(), preview_text: preview, from_name: s.from_name, reply_to: s.reply_to },
    });
    console.log('✓ New DRAFT created — nothing was sent.\n');
    console.log(describe(updated));
    console.log('\nNext: open the edit link, update this week\'s content in Mailchimp, and save.');
    break;
  }
  case 'check': {
    if (!id) fail('Usage: check <id>');
    const c = await api('GET', `/campaigns/${id}`);
    console.log(describe(c) + '\n');
    const { is_ready, items } = await api('GET', `/campaigns/${id}/send-checklist`);
    for (const i of items) console.log(`${i.type === 'success' ? '✓' : i.type === 'warning' ? '!' : '✗'} ${i.heading}: ${i.details}`);
    console.log(is_ready ? '\nREADY to send.' : '\nNOT READY — fix the ✗ items in Mailchimp first.');
    break;
  }
  case 'test': {
    if (!id) fail('Usage: test <id> [email...]');
    const to = rest.length ? rest : (process.env.MAIL_TEST_TO || '').split(',').map((e) => e.trim()).filter(Boolean);
    if (!to.length) fail('No test address. Add one (test <id> you@example.com) or set up the key again with --email.');
    if (to.length > 6) fail('Mailchimp allows at most 6 test addresses.');
    await api('POST', `/campaigns/${id}/actions/test`, { test_emails: to, send_type: 'html' });
    console.log(`✓ Test email sent to: ${to.join(', ')} (check spam if it doesn't arrive in a few minutes).`);
    break;
  }
  case 'send': {
    if (!id) fail('Usage: send <id> --confirm');
    const c = await api('GET', `/campaigns/${id}`);
    console.log(describe(c) + '\n');
    const r = c.recipients || {};
    if (c.status !== 'save') fail(`This email's status is "${c.status}", not a draft. Refusing to send.`);
    if (r.list_name !== AUDIENCE) fail(`Audience is "${r.list_name || 'none'}", not "${AUDIENCE}". Fix the "To" field in Mailchimp. Refusing to send.`);
    if (!r.recipient_count) fail('This email has 0 recipients. Refusing to send.');
    const prev = await lastSent();
    if (prev && prev.settings.subject_line.trim() === (c.settings.subject_line || '').trim()) {
      fail(`An email with this exact subject was already sent ${fmt(prev.send_time)}. Change the subject/date in Mailchimp if this is a new week. Refusing to send.`);
    }
    if (prev && Math.abs(r.recipient_count - prev.emails_sent) > prev.emails_sent * 0.15) {
      console.log(`⚠ Recipient count (${r.recipient_count}) is quite different from last time (${prev.emails_sent}). Double-check the audience.\n`);
    }
    const { is_ready } = await api('GET', `/campaigns/${id}/send-checklist`);
    if (!is_ready) fail('Mailchimp says this email is not ready. Run "check" to see what to fix.');
    if (!rest.includes('--confirm')) {
      console.log(`Ready. Nothing sent yet. Sending would go to ${r.recipient_count} people in "${r.list_name}".`);
      break;
    }
    await api('POST', `/campaigns/${id}/actions/send`);
    console.log(`✓ SENT "${c.settings.subject_line}" to ${r.recipient_count} people.`);
    break;
  }
}
