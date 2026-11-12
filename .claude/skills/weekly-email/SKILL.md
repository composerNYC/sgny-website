---
name: weekly-email
description: Make, preview and send SGNY's weekly "🔵 Weekly Schedule" Mailchimp email with Joao, step by step. Use whenever Joao (or anyone) talks about the weekly email, this week's/next week's email, the newsletter, the Mailchimp email, flyers, photos or announcements for the email, a practice run or test drive, changing the email, sending a test, or sending the email.
---

# SGNY weekly email

Joao is not technical, is very visual, and does not design in Mailchimp. **You do the whole email and lead the conversation.** He tells you what's happening and drops in the flyers. You write the short descriptions, lay it out, show him pictures of the options and the finished email, and only after he approves do you put it in Mailchimp, send him a test, and send it.

How to talk to him:
- Plain, warm, short. One question at a time. No jargon (never say JSON, HTML, campaign, API, commit, folder path).
- Answer in the language he writes in (he may write in Portuguese). The email itself stays in English unless he asks otherwise.
- Do the work yourself. Never ask him to write a paragraph, format anything or find a link you can find. Ask only for facts you can't know.
- Show, don't describe. Whenever there's something to look at, put it in front of him as a page (see "Showing him things").

The hard rules in `CLAUDE.md` (sending, confirmation, API key) always apply.

## The conversation, step by step

### 0. Get ready (silently)
- `git pull --ff-only` so this skill and the email look are up to date. If it fails, carry on and mention it to him only if something later doesn't work.
- If he said "practice", "test drive", "try it out" or similar, this is a **practice run**: the subject starts with `PRACTICE ` (e.g. `PRACTICE 🔵 Weekly Schedule (November 16, 2026)`). Everything works the same, but it ends after the test email (see step 7). Tell him once at the start: "This is a practice run, so nothing will go to the list."

### 1. The date
Work out the Monday of the coming week from today's date and ask him to confirm: *"Is this email for the week of Monday, November 16?"* Use his answer (it may be another day). Then run:

`node scripts/email-builder.mjs next "🔵 Weekly Schedule (<Month D, YYYY>)"` (with `PRACTICE ` in front for a practice run).

This copies last week's email into a new week, keeping everything that was in it.

### 2. What stays from last week
Look at the announcements carried over (the items between `@this-week-header` and `@sgny-website`). Tell him in one short list what's there, in plain words ("the Spiritist Week flyers, Nov 15–22", "Rafael Rezende's talk, Nov 14"). **Mark anything whose date has already passed and say you'll take it out unless he wants it.** Ask: *"Anything else to take out?"*

### 3. What's new this week
1. Run `open "emails/weeks/<folder>"` so the week's folder pops up on his screen, and say: *"Drag this week's flyers or photos into the window that just opened. Tell me when they're in."* (Pictures pasted into the chat aren't saved as files, so they must go in that window.)
2. For each new thing, ask for **just the basics**, as short as he likes: what it is, when (day, date, time), where (in person / online / place), who's speaking or leading, and the link if there is one. Tell him he can paste a WhatsApp message or flyer text as it is.
3. If he has no new announcements this week, that's fine. Go to step 4.

### 4. You do the writing
- **Look at how it was done before.** Search earlier weeks for the same event, speaker, book or series: `grep -ril "<keyword>" emails/weeks/*/week.json`. For older emails, `node scripts/mailchimp.mjs sent 20`, then `node scripts/mailchimp.mjs content <id> <scratch-dir>/<id>.html` for the likely ones and search the text. If it was announced before, reuse that wording and layout so the email stays consistent, updating only dates and details.
- **Write the description yourself** from his basics, in the house style of past emails: one bold first line with the key fact and the date/time ("**Join us live this Saturday, November 14, at 11:00am EST.**"), then one or two short, warm sentences, then the link as a word ("Register <a href=...>here</a>"). Times look like "7:00pm EST"; dates like "November 14". Keep it short; the flyer usually carries the details.
- **Check everything.** Look at every photo with the Read tool. Check it's readable, not blurry or cut off, and that it agrees with the facts (dates, times, places, names); if a weekday doesn't match its date, ask. For HEIC or very large files, build once (step 5) and look at the copies in the week's `.build/` folder. Check each new link: `curl -sL -o /dev/null -w '%{http_code}\n' "<url>"` must print 200. Never use Mailchimp tracking links (`list-manage.com/track/...`).
- **Never invent facts.** If a time, place, price, speaker or link is missing or the photo and his text disagree, ask him.
- If you fixed or reworded anything he wrote, tell him in one line what you changed.

### 5. Options (when there's a real choice)
When a new announcement could reasonably look different ways, show him **2 or 3 options side by side** instead of asking in words. Good choices to offer:
- flyer only vs. flyer + short invitation vs. headline first, then flyer;
- which announcement goes first;
- a shorter vs. a fuller description;
- for several photos of one event: all of them vs. the best one.

Write `emails/weeks/<folder>/options.json`:
```json
{ "question": "How should we announce Rafael Rezende's talk?",
  "options": [
    { "label": "Flyer only", "note": "Clean. The flyer already says everything.", "content": [ { "image": "talk.jpg", "alt": "..." }, "---" ] },
    { "label": "Flyer + short invitation", "note": "Adds a warm line and the link.", "content": [ ... ] } ] }
```
Each option's `content` uses the same items as week.json. Then run `node scripts/email-builder.mjs options emails/weeks/<folder>/week.json` and show `options.html` (see "Showing him things"). Ask: *"Which one do you like: A, B or C? Or tell me what to change."* Put his choice into week.json. Offer options for the things that matter, not for everything: usually one options page per email is plenty. If nothing is new, skip this step.

### 6. The finished email
- Add the latest videos: `node scripts/email-builder.mjs videos` lists the newest uploads with dates; take the ones published since the last email (usually the Thursday Spirits' Book study and the Sunday study). The YouTube titles leave out the book, so add it in front, e.g. `The Spirits' Book: Introduction, Items VIII, IX and X`, `The Gospel According to Spiritism: Blessed Are the Afflicted`. The Sunday book is the one for that Sunday in the rotation. If unsure, ask.
- Build: `node scripts/email-builder.mjs emails/weeks/<folder>/week.json`. Fix every ✗; fix each ⚠ or tell him about it. If it says the email is too big for Gmail, suggest taking out the oldest announcement.
- Show `preview.html` (see "Showing him things") with a three-line summary: what's new at the top, the Sunday line, the two videos. Ask: *"Does this look right? Tell me anything you'd like changed."*
- Change what he asks, rebuild, and show it again (same link). Only a clear "looks good / approved" counts as approval of this version; if you change anything after that, he approves again.

### 7. Into Mailchimp, test, send
1. `node scripts/mailchimp.mjs drafts`. If a draft with exactly this subject exists and its `made by:` line says Claude, use it; otherwise `node scripts/mailchimp.mjs new "<subject>"`.
2. Follow "Send me a test" and "Send it" in `CLAUDE.md` exactly (fill → check → test → he looks at his inbox → dry run → one yes/no question → send). `test` and `send` take the week file and refuse if the draft isn't the latest approved version.
3. If he asks for a change after the test: edit, rebuild, show the preview, get his approval, then `fill` again and send a new test before sending.
4. **Practice run:** stop after he has looked at the test email. Never offer to send it (the script refuses anyway). Then clean up: `node scripts/mailchimp.mjs delete-practice <id>` and remove the practice folder (`rm -r "emails/weeks/<date>-practice"`). Tell him: *"That's the whole thing! Next time we do it for real, the only extra step is a final yes before it goes out."*

## Showing him things
He's visual: put every options page and preview in front of him; never just describe them.
- Publish the page with the Artifact tool. It opens for him automatically. Titles: the preview's title is the email subject; the options page has its own. Republish **the same file** after every change so the link stays the same and his open page updates. Each new week gets new pages.
- If the Artifact tool isn't available or fails, run `open "<path to the .html>"`, which opens it in his web browser.
- Pages are previews only; the test email in his inbox is the final check of how it really looks.

## How the email is made
- The look is fixed and copied from the real Nov 9, 2026 email: `emails/layout.html` (frame, header, footer) and `emails/blocks/` (the parts that repeat every week). Don't edit these for a normal week.
- Each week has a folder `emails/weeks/<YYYY-MM-DD>/` (practice: `<YYYY-MM-DD>-practice`) with `week.json` (what goes in the email, top to bottom), that week's photos, and the built `preview.html` / `options.html`.
- `node scripts/mailchimp.mjs new "<subject>"` creates an empty draft; `fill <draft-id> <week.json>` uploads the photos and puts the email in it. Never use `copy` for this: a copied draft is tied to the old Mailchimp template and Mailchimp undoes the new content.

### week.json

```json
{
  "subject": "🔵 Weekly Schedule (November 16, 2026)",
  "previewText": "Please take a look at our schedule for this week (November 16, 2026)",
  "content": [
    "@this-week-header",
    { "image": "symposium.jpg", "alt": "20th US Spiritist Symposium, Nov 7, Dania Beach FL", "link": "https://..." },
    { "text": "<strong>3 DAYS TO GO!</strong>\nThe countdown is on.\n\nRegister <a href=\"https://...\">here</a>.", "align": "center", "size": 16 },
    "---",
    "@sgny-website", "---", "@podcast", "---", "@donations", "---", "@youtube", "---", "@schedule", "---", "@quote", "---", "@social", "---", "@footer"
  ],
  "videos": [
    { "title": "The Spirits' Book: Introduction, Items VIII, IX and X", "url": "https://www.youtube.com/watch?v=-eQSiZYKTNc" }
  ],
  "sunday": { "title": "Study Group - ...", "text": "..." }
}
```

- `"@name"`: a standing part from `emails/blocks/`: `this-week-header` (the "THIS WEEK AT SGNY" banner), `sgny-website`, `posthumous-works`, `prism-of-grief`, `revue-spirite`, `learning-platform`, `podcast`, `be-my-hope`, `donations`, `youtube` (banner, video list, channel button), `schedule` (banner, weekly schedule, Zoom details), `quote`, `social`, `footer`. Keep `@donations` through `@footer` in that order at the end.
- `"---"`: the thin grey line between sections. One between sections; several photos of one announcement go together with no line between them.
- `{ "image": ... }`: a photo or flyer, either a file in the week folder or a `https://` link. `alt` is required: a short description of what the image says. `link` is optional: where it goes when clicked. `width` is optional (pixels, at most 564). Leave it out and the picture fills the column if it's at least 564 pixels wide, otherwise it shows at its own size. Set it for things like a book cover (about 330). Photos are resized, turned upright and converted (HEIC → JPEG) automatically.
- `{ "text": ... }`: plain text. A blank line starts a new paragraph and a single line break is kept. Only `<a href="...">`, `<strong>`, `<em>`, `<u>`, `<br>` are allowed. Links are styled blue automatically. `align`: `justify` (default, like the book blurbs), `center` or `left`. `size`: 14 (default body), 16 for short centered announcements, 18 for a headline.
- `videos`: the "latest videos" list (usually 2).
- `sunday`: leave it out. The builder fills in the Sunday line from the monthly rotation (1st Sunday Sex and Destiny, 2nd Gospel, 3rd The Mediums' Book, 4th Q&A Session). Set it only when Joao says that Sunday is different, or `"none"` if there's no Sunday session. On a 5th Sunday the builder stops; ask him what happens that day.
- `uploaded`: written by `fill` (each uploaded photo's Mailchimp link); don't touch it.

Whatever is in the list carries over to next week until it's removed, so a promotion that runs for several weeks stays in by itself.

## If he wants something the email can't do yet
Changing a standing part (new Zoom details, a new quote, retiring the podcast) means editing `emails/blocks/<name>.html` or removing it from the list. Removing is fine. For edits to the schedule, Zoom or footer text, make the change, show him the preview, and mention that this changes every future email. Don't redesign the layout. If he asks for a new look, tell him you'll pass it on to whoever set this up, and stop.
