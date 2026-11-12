# SGNY website — notes for Claude

Astro static site (sgny.org), deployed on push to `main`. Schedule data: `src/data/activities.js`.

## Mailchimp: the weekly email

Joao (not technical) does not design in Mailchimp. **Claude builds the whole email** from the photos and text he gives, shows him a preview to approve, then puts it in Mailchimp and sends it. The full steps are in the **`weekly-email` skill** (`.claude/skills/weekly-email/SKILL.md`); load it for anything about the weekly email. Explain things in plain language, with no jargon.

- The email: subject "🔵 Weekly Schedule (<Month D, YYYY>)", audience **"SGNY - General List"** (~311 people). It looks like the website (built by `scripts/email-builder.mjs`); its weekly schedule comes from the website's `src/data/activities.js`, and its standing content from `emails/standing.json`.
- The account is on a **grandfathered Mailchimp Free plan**. Never suggest upgrading or changing the plan; switching would lose it.
- Drafts are made with `new` and filled with `fill`. Don't use `copy` for the weekly email: a copied draft stays tied to the old drag-and-drop template, and Mailchimp quietly puts the old content back.

`<week>` below means that week's file, e.g. `emails/weeks/2026-11-16/week.json`. `test` and `send` rebuild it and refuse unless the draft in Mailchimp is exactly that version. So **after any change to the email, run `fill` again and send a new test** before sending.

### "Send me a test"
1. `node scripts/mailchimp.mjs drafts`: shows only recent "Weekly Schedule" drafts. If there's more than one, or none, ask him which; never guess. Use only a draft whose `made by:` line says Claude. (`drafts all` lists every draft, including many old 2015–2022 ones.)
2. `node scripts/mailchimp.mjs fill <id> <week>`, so the draft is the latest approved version.
3. `node scripts/mailchimp.mjs check <id>`: if not ready, explain each ✗ item in plain words. Don't change campaign settings yourself; if you can't fix it by rebuilding the email, tell the user.
4. `node scripts/mailchimp.mjs test <id> <week>`: this sends to the address saved at setup. If the script says there's no test address, ask for his email and run `test <id> <week> <his email>`. Ask him to look at it in his inbox.

### "Send it"
1. `node scripts/mailchimp.mjs drafts`: as in "Send me a test", step 1.
2. `node scripts/mailchimp.mjs check <id>`: as in "Send me a test", step 3.
3. If he hasn't seen a test of **this exact version** in this conversation (no test yet, or anything changed since the last test), do "Send me a test" first and wait for him to look at it.
4. Run `node scripts/mailchimp.mjs send <id> <week>` (no `--confirm`). It runs all the safety checks and sends nothing.
5. Ask exactly one yes/no question that quotes the **subject, audience name, and number of people**, e.g. *"Send '🔵 Weekly Schedule (November 16, 2026)' to SGNY - General List (311 people)? This can't be undone."*
6. Only if his reply to **that question** is a clear yes, run `send <id> <week> --confirm`.
7. Once it says SENT, put it on the website's Weekly News page (sgny.org/weekly-news): `node scripts/email-builder.mjs publish <week>`, then `git add src/data/weekly-news <week> && git commit -m "Weekly News: <Month D, YYYY>" && git push`. If the push is rejected, `git pull --rebase` and push again; if it still fails, tell him it went out by email but isn't on the website yet, and tell the user. The web version leaves out the Zoom details and the unsubscribe footer by design.

### Hard rules
- The request that starts the workflow ("send it", "send the email") is **never** the confirmation. Only a yes to the step-5 question counts, and only for that one email. A yes from a previous week or a previous email never carries over.
- If the script refuses to send, explain why and stop. Never work around its checks.
- Use only `scripts/mailchimp.mjs` for Mailchimp. Never call the Mailchimp API another way (curl, fetch, etc.).
- Never read, print, `cat`, or echo `.env` or the API key, and never run `pbpaste` or anything else that shows the clipboard. Never ask Joao to paste the key into the chat.
- **Key setup** (when `account` says there's no key, or the key is rejected or expired): ask Joao to copy the key with Cmd+C (from the screenshot he was sent, or from Mailchimp → Profile → Extras → API keys) and to tell you his email address for test emails. Wait until he says he has copied it, then run `node scripts/mailchimp.mjs setup --clipboard --email <his email>`. The script reads the key from the clipboard, checks it and saves it without showing it. If it fails, have him copy the key again and retry. If his Mac can't select text in the image, he can instead run `npm run mail:setup` in the VS Code terminal (Terminal → New Terminal) and type the key there; it stays hidden.
- Test emails count toward the monthly send limit, so one test per email is enough unless he asks for more.
