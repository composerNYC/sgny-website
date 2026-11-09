# SGNY website — notes for Claude

Astro static site (sgny.org), deployed to GitHub Pages on push to `main`. Schedule data: `src/data/activities.js`.

## Mailchimp: the weekly email

Joao (not technical) designs the weekly email in the Mailchimp web editor. You run the steps with `node scripts/mailchimp.mjs`. Explain things in plain language, with no jargon, and always give him the `edit link:` when he needs to do something in Mailchimp.

- The email: subject "🔵 Weekly Schedule (<Month D, YYYY>)", audience **"SGNY - General List"** (~311 people). Each week's email starts as a copy of the last one sent.
- The account is on a **grandfathered Mailchimp Free plan**. Never suggest upgrading or changing the plan; switching would lose it.

### "Start next week's email"
1. `node scripts/mailchimp.mjs sent 1` → note its id.
2. Ask Joao which date to put in the subject (past emails used the date of the week they announce). Do not guess.
3. `node scripts/mailchimp.mjs copy <id> "🔵 Weekly Schedule (<date>)"`. This creates a draft only.
4. Give him the edit link and wait until he says it's ready.

### "Send it"
1. `node scripts/mailchimp.mjs drafts`: shows only recent "Weekly Schedule" drafts. If there's more than one, or none, ask him which; never guess. (`drafts all` lists every draft, including many old 2015–2022 ones.)
2. `node scripts/mailchimp.mjs check <id>`: if not ready, explain each ✗ item in plain words and how to fix it in Mailchimp. Don't change campaign settings yourself.
3. `node scripts/mailchimp.mjs test <id>`: this sends a test to the address saved in `.env`. Ask him to look at it in his inbox.
4. Run `node scripts/mailchimp.mjs send <id>` (no `--confirm`). It runs all the safety checks and sends nothing.
5. Ask exactly one yes/no question that quotes the **subject, audience name, and number of people**, e.g. *"Send '🔵 Weekly Schedule (November 16, 2026)' to SGNY - General List (311 people)? This can't be undone."*
6. Only if his reply to **that question** is a clear yes, run `send <id> --confirm`.

### Hard rules
- The request that starts the workflow ("send it", "send the email") is **never** the confirmation. Only a yes to the step-5 question counts, and only for that one email. A yes from a previous week or a previous email never carries over.
- If the script refuses to send, explain why and stop. Never work around its checks.
- Use only this script. Never call the Mailchimp API another way (curl, fetch, etc.).
- Never read, print, `cat`, or echo `.env` or the API key. Never ask Joao to paste the key into the chat. If the key is missing, invalid or expired, tell him to make a new key in Mailchimp (Profile → Extras → API keys) and run `npm run mail:setup` in the VS Code terminal.
- Test emails count toward the monthly send limit, so one test per email is enough unless he asks for more.
