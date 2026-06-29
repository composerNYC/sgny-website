#!/usr/bin/env node
// Pre-launch parity gate: compares the new site's catalog.json against the
// LIVE production store (www.sgny.org), which is the source of truth, and fails
// if any book disagrees on price or purchasability.
//
// Why this exists: the WordPress->Astro migration silently mis-set `forSale`
// and price fields on a number of books (e.g. Nosso Lar showed "Ask about
// availability" while production sold it). This check makes that class of bug
// impossible to ship unnoticed — run it before every go-live.
//
//   node scripts/verify-prices.mjs            # check all books, exit 1 on any mismatch
//   node scripts/verify-prices.mjs --json     # machine-readable report
//
// It fetches each book's production page, extracts the displayed price and
// whether a "Buy with PayPal" button is present, then compares to catalog.json:
//   - production sells it  -> new site must have forSale:true + matching price + a PayPal amount
//   - production does not  -> new site must NOT show a Buy button
//   - price strings must match exactly
//
// Network access to www.sgny.org is required (run locally or in CI, not the sandbox).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATALOG = JSON.parse(readFileSync(join(ROOT, 'src/data/catalog.json'), 'utf8'));
const JSON_OUT = process.argv.includes('--json');

const books = CATALOG.filter((p) => p.type === 'book');

// Map a new-site book to its production URL. Production uses
// /catalog/books/<author>/<slug>/ ; the new site stores the production URL in
// `prodUrl` when known, else we fall back to deriving it.
function prodUrl(b) {
  if (b.prodUrl) return b.prodUrl;
  return null; // unknown — flagged below rather than guessed
}

const PRICE_RE = /US\$\s?\d+(?:\.\d{2})?/;
const BUY_RE = /buy\s+with\s+paypal/i;

async function fetchBook(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const text = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ');
  const priceMatch = text.match(PRICE_RE);
  return {
    price: priceMatch ? priceMatch[0].replace(/\s/g, '') : null,
    hasBuy: BUY_RE.test(html),
  };
}

function norm(p) {
  return p == null ? '' : String(p).replace(/\s/g, '');
}

const problems = [];
const checked = [];

for (const b of books) {
  const url = prodUrl(b);
  if (!url) {
    problems.push({ title: b.title, kind: 'NO_PROD_URL', detail: 'no production URL recorded to verify against' });
    continue;
  }
  let prod;
  try {
    prod = await fetchBook(url);
  } catch (e) {
    try { prod = await fetchBook(url); } // one retry
    catch (e2) { problems.push({ title: b.title, kind: 'FETCH_FAILED', detail: String(e2.message || e2), url }); continue; }
  }

  const siteSells = !!b.forSale && norm(b.amount) !== '';
  const sitePrice = norm(b.price);
  const prodSells = prod.hasBuy;
  const prodPrice = norm(prod.price);

  // Parity rule 1: purchasability must match
  if (prodSells !== siteSells) {
    problems.push({
      title: b.title, kind: 'SALE_MISMATCH', url,
      detail: `production ${prodSells ? 'SELLS' : 'does NOT sell'} but new site ${siteSells ? 'SELLS' : 'does NOT'}`,
    });
  }

  // Parity rule 2: displayed price must match (when production shows one)
  if (prodPrice && sitePrice && prodPrice !== sitePrice) {
    problems.push({ title: b.title, kind: 'PRICE_MISMATCH', url, detail: `production ${prodPrice} vs new site ${sitePrice}` });
  } else if (prodPrice && !sitePrice) {
    problems.push({ title: b.title, kind: 'PRICE_MISSING', url, detail: `production shows ${prodPrice}, new site shows none` });
  }

  // Parity rule 3: internal consistency — a sellable book must render a price
  if (siteSells && !sitePrice) {
    problems.push({ title: b.title, kind: 'HIDDEN_BUY', url, detail: 'forSale + amount set but no display price, so the card is hidden' });
  }

  checked.push(b.title);
}

if (JSON_OUT) {
  console.log(JSON.stringify({ checked: checked.length, problems }, null, 2));
} else {
  console.log(`\nParity check: ${checked.length}/${books.length} books verified against production.\n`);
  if (problems.length === 0) {
    console.log('✓ PASS — every book is in parity (price + buy button) with www.sgny.org\n');
  } else {
    console.log(`✗ FAIL — ${problems.length} book(s) out of parity:\n`);
    for (const p of problems) console.log(`  [${p.kind}] ${p.title}\n      ${p.detail}${p.url ? '\n      ' + p.url : ''}`);
    console.log('');
  }
}

process.exit(problems.length ? 1 : 0);
