// Weekly News: the web versions of the weekly email, newest first.
// Each issue is written by `node scripts/email-builder.mjs publish <week.json>` after the email is sent.
const files = import.meta.glob('../data/weekly-news/*.json', { eager: true, import: 'default' });

export const issues = Object.values(files).sort((a, b) => b.slug.localeCompare(a.slug));
export const latest = issues[0];

// The Mailchimp sign-up form for the weekly email (audience "SGNY - General List").
export const subscribeUrl = 'https://sgny.us10.list-manage.com/subscribe?u=b68e90a1f6237b2836846604b&id=4a70533545';
