import { defineConfig } from 'astro/config';
import pagefind from 'astro-pagefind';
import sitemap from '@astrojs/sitemap';

// Fully static output: every page is prerendered to plain HTML (fast, free,
// great SEO) and the whole site can be hosted for free on GitHub Pages.
// NOTE: the prayer submit endpoint + private prayer book are temporarily set
// aside; when re-added they need a host that runs server code (e.g. Netlify).
export default defineConfig({
  site: 'https://www.sgny.org',
  output: 'static',
  integrations: [
    pagefind(),
    sitemap({
      filter: (page) =>
        !page.includes('/bibliographies/') &&
        !page.includes('/catalog/videos') &&
        !page.includes('/catalog/books/list-by-title') &&
        !page.includes('/catalog/books/sab-publications'),
    }),
  ],
  build: { format: 'directory' },
  // Pages merged into other pages; keep the old URLs working.
  redirects: {
    '/online-studies': '/activities-schedule',
    // retired stale duplicates of the /biographies section
    '/bibliographies/allan-kardec': '/biographies/allan-kardec',
    '/bibliographies/francisco-xavier': '/biographies/francisco-xavier',
    '/bibliograhies/henry-sausse': '/spiritism-guide#biographies',
    // Biographies + Lexicon were consolidated into the Guide to Spiritism one-pager.
    '/biographies': '/spiritism-guide#biographies',
    '/spiritist-lexicon': '/spiritism-guide#great-names',
  },
});
