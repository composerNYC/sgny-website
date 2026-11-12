// Latest uploads on the SGNY YouTube channel, newest first: [{ id, title, date: 'YYYY-MM-DD', exact }].
// Used by the Spiritist Videos page (at build time) and by scripts/email-builder.mjs (`videos`).
//
// YouTube's RSS feed goes down for hours at a time (it returns 404), so:
//   1. the RSS feed, a few tries (exact dates);
//   2. otherwise the channel's public "Videos" page (dates worked out from "2d ago", "3w ago"...);
//   3. otherwise null, and the caller uses its saved list.

export const CHANNEL_ID = 'UC8IaYwI9obGOFko2kwXQb8A'; // Spiritist Group of New York

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fromRss(tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, { headers: { 'User-Agent': UA } });
      if (res.ok) {
        const xml = await res.text();
        const list = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
          const id = e.match(/<yt:videoId>([^<]+)</)?.[1];
          const title = e.match(/<title>([^<]+)<\/title>/)?.[1];
          const published = e.match(/<published>([^<]+)</)?.[1];
          return id && title && published ? { id, title: decode(title), date: published.slice(0, 10), exact: true } : null;
        }).filter(Boolean);
        if (list.length) return list;
      }
    } catch { /* try again */ }
    if (i < tries - 1) await sleep(1500 * (i + 1));
  }
  return null;
}

// "2d ago", "3 weeks ago", "1mo ago", "5 hours ago" → a date (approximate).
function agoToDate(text, now = Date.now()) {
  const m = String(text || '').match(/(\d+)\s*(seconds?|secs?|s|minutes?|mins?|hours?|hrs?|h|days?|d|weeks?|wks?|w|months?|mo|years?|yrs?|y)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  const DAY = 864e5;
  const ms = /^(s|sec)/.test(u) ? n * 1e3 : /^(m(in|inute)?s?)$/.test(u) && u !== 'mo' ? n * 6e4 : /^(h|hr|hour)/.test(u) ? n * 36e5
    : /^d/.test(u) ? n * DAY : /^w/.test(u) ? n * 7 * DAY : /^mo/.test(u) ? n * 30 * DAY : n * 365 * DAY;
  return new Date(now - ms).toISOString().slice(0, 10);
}

async function fromChannelPage() {
  try {
    const res = await fetch(`https://www.youtube.com/channel/${CHANNEL_ID}/videos`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' } });
    if (!res.ok) return null;
    const html = await res.text();
    const json = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)?.[1];
    if (!json) return null;
    const list = [];
    JSON.stringify(JSON.parse(json), (k, v) => {
      if (k === 'lockupViewModel' && v?.contentId) {
        const title = v.metadata?.lockupMetadataViewModel?.title?.content;
        const ago = JSON.stringify(v.metadata || {}).match(/"content":"([^"]*\bago)"/)?.[1];
        const date = agoToDate(ago);
        if (title && date) list.push({ id: v.contentId, title, date, exact: false });
      }
      if (v?.videoId && v?.publishedTimeText && v?.title) { // older page layout
        const title = v.title.runs?.[0]?.text || v.title.simpleText;
        const date = agoToDate(v.publishedTimeText.simpleText);
        if (title && date) list.push({ id: v.videoId, title, date, exact: false });
      }
      return v;
    });
    const unique = list.filter((x, i) => list.findIndex((y) => y.id === x.id) === i);
    return unique.length ? unique : null;
  } catch { return null; }
}

export async function latestVideos() {
  const rss = await fromRss();
  if (rss) return { videos: rss, source: 'rss' };
  const page = await fromChannelPage();
  if (page) return { videos: page, source: 'channel-page' };
  return { videos: null, source: 'none' };
}
