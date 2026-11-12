#!/usr/bin/env node
// Alarm for the Spiritist Videos page: is the newest video shown on the LIVE site recent?
// SGNY uploads every week, so if the newest is older than MAX_DAYS, something is stuck
// (YouTube unreachable at build time, or the daily rebuild not running).
// Exit code 1 + a message when stale; run daily by .github/workflows/videos-watch.yml,
// which then opens a GitHub issue (GitHub emails the repo owner).
const URL_ = 'https://sgny.org/spiritist-videos/';
const MAX_DAYS = Number(process.env.MAX_DAYS || 10);

const res = await fetch(URL_, { headers: { 'Cache-Control': 'no-cache' } });
if (!res.ok) {
  console.log(`The Spiritist Videos page (${URL_}) didn't load: HTTP ${res.status}.`);
  process.exit(1);
}
const html = await res.text();
const dates = [...html.matchAll(/data-date="(\d{4}-\d{2}-\d{2})"/g)].map((m) => m[1]).sort();
if (!dates.length) {
  console.log(`Couldn't find any video dates on ${URL_} (the page layout may have changed).`);
  process.exit(1);
}
const newest = dates.at(-1);
const days = Math.floor((Date.now() - Date.parse(newest + 'T12:00:00Z')) / 864e5);
if (days > MAX_DAYS) {
  console.log(`The newest video on ${URL_} is from ${newest} (${days} days ago). SGNY uploads weekly, so the page is probably stuck: YouTube may have been unreachable during the daily rebuild, or the rebuild isn't running. Check the latest "Deploy to GitHub Pages" run and its log for "[spiritist-videos]". If the channel really hasn't uploaded in ${MAX_DAYS} days, close this issue.`);
  process.exit(1);
}
console.log(`OK: newest video on the page is from ${newest} (${days} days ago).`);
