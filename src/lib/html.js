// Clean legacy WordPress body HTML for the new site.
export function cleanBody(html) {
  if (!html) return '';
  let h = html;
  // images: point wp uploads to local /uploads/
  h = h.replace(/https?:\/\/www\.sgny\.org\/wp-content\/uploads\//g, '/uploads/');
  // internal links: strip origin so they resolve to new routes; drop trailing slashes
  h = h.replace(/https?:\/\/www\.sgny\.org/g, '');
  // remove the old left-sidebar nav images / spacer gifs / theme img refs
  h = h.replace(/<img[^>]*\/(?:img|images)\/[^>]*>/gi, '');
  h = h.replace(/<img[^>]*pixel\.gif[^>]*>/gi, '');
  // drop inline width/height/style noise from tables used for layout
  h = h.replace(/\sstyle="[^"]*"/gi, '');
  h = h.replace(/\s(?:width|height|border|cellpadding|cellspacing|align|bgcolor)="[^"]*"/gi, '');
  // strip empty paragraphs
  h = h.replace(/<p>\s*(&nbsp;)?\s*<\/p>/gi, '');
  return h.trim();
}

// turn "/catalog/books/allan-kardec/spirits-book" legacy links into new "/catalog/allan-kardec/spirits-book"
export function rewriteCatalogLinks(html) {
  return html.replace(/\/catalog\/books\//g, '/catalog/');
}
