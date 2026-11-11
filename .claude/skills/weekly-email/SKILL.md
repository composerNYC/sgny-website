---
name: weekly-email
description: Make, preview and send SGNY's weekly "🔵 Weekly Schedule" Mailchimp email for Joao. Use whenever Joao (or anyone) talks about the weekly email, this week's/next week's email, the newsletter, the Mailchimp email, flyers or photos for the email, changing the email's text, sending a test, or sending the email.
---

# SGNY weekly email

Joao is not technical and does not design in Mailchimp. **You do the whole email.** He gives you this week's flyers, photos and text; you proofread, lay it out, show him a preview, and only after he approves do you put it in Mailchimp, send him a test, and send it.

Talk to him in plain, friendly language. No jargon (don't say JSON, HTML, campaign, API, commit). Short messages. One question at a time.

The hard rules in `CLAUDE.md` (sending, confirmation, API key) always apply.

## How the email is made

- The look is fixed and copied from the real Nov 9, 2026 email: `emails/layout.html` (frame, header, footer) and `emails/blocks/` (the parts that repeat every week). Don't edit these files for a normal week.
- Each week has a folder `emails/weeks/<YYYY-MM-DD>/` with a `week.json` (what goes in the email, top to bottom) and that week's photos.
- `node scripts/email-builder.mjs <week.json>` builds `preview.html` in that folder.
- `node scripts/mailchimp.mjs new "<subject>"` creates an empty draft. `fill <draft-id> <week.json>` uploads the photos and puts the email in the draft. Never use `copy` for this: a copied draft is tied to the old Mailchimp template and Mailchimp undoes the new content.

### week.json

```json
{
  "subject": "🔵 Weekly Schedule (November 16, 2026)",
  "previewText": "Please take a look at our schedule for this week (November 16, 2026)",
  "content": [
    "@this-week-header",
    { "image": "symposium.jpg", "alt": "20th US Spiritist Symposium, Nov 7, Dania Beach FL", "link": "https://..." },
    { "text": "<strong>3 DAYS TO GO!</strong>\nThe countdown is on.\n\nRegister: <a href=\"https://...\">tickettailor.com/...</a>", "align": "center", "size": 16 },
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
- `"---"`: the thin grey line between sections. Put one between sections; put several photos of one announcement together with no line between them.
- `{ "image": ... }`: a photo or flyer, either a file in the week folder or a `https://` link. `alt` is required: a short description of what the image says. `link` is optional: where it goes when clicked. `width` is optional (pixels, at most 564). Leave it out and the picture fills the column (564) if it's at least 564 pixels wide, otherwise it shows at its own size. Set it for things like a book cover (about 330). Photos are resized, turned upright and converted (HEIC → JPEG) automatically.
- `{ "text": ... }`: plain text. A blank line starts a new paragraph and a single line break is kept. Only `<a href="...">`, `<strong>`, `<em>`, `<u>`, `<br>` are allowed. Links are styled blue automatically. `align`: `justify` (default, like the book blurbs), `center` or `left`. `size`: 14 (default body), 16 for short centered announcements, 18 for a headline.
- `videos`: the "latest videos" list (usually 2).
- `sunday`: leave it out. The builder fills in the Sunday line from the monthly rotation (1st Sunday Sex and Destiny, 2nd Gospel, 3rd The Mediums' Book, 4th Q&A Session). Set it only when Joao says that Sunday is different, or `"none"` if there's no Sunday session. On a 5th Sunday the builder stops and asks.
- `uploaded`: written by `fill` (each uploaded photo's Mailchimp link); don't touch it.

Whatever is in the list carries over to next week until it's removed, so a promotion that runs for several weeks stays in by itself.

## Steps

### 1. Start the week
1. Ask Joao which date goes in the subject (the Monday of the week the email announces, usually). Don't guess.
2. `node scripts/email-builder.mjs next "🔵 Weekly Schedule (<Month D, YYYY>)"`. This copies last week's list into a new folder.
3. Run `open emails/weeks/<YYYY-MM-DD>` so the folder opens in Finder, and ask him to drag this week's flyers and photos into it. Then ask him to type (or paste) the text for each announcement here in the chat, and say which old announcements to take out. Photos only pasted into the chat are not saved as files, so they must go in the folder.

### 2. Review what he sent
- Look at every photo with the Read tool. For HEIC or very large files, build once (step 3) and look at the converted copies in the week's `.build/` folder. Check that it's readable at email width, isn't blurry or cut off, and agrees with the text (dates, times, places, names). If a flyer is in Portuguese or Spanish, that's fine. Mention it only if the text around it is in English and he might want a translation.
- Proofread his text: spelling, grammar, punctuation, consistent capitalization, times written like the rest of the email ("7:00pm", "11:00am - 12:30pm", "EST"). Check that each weekday matches its date. Keep his wording and tone; fix only what's wrong.
- Never invent facts. If a time, place, price, speaker or link is missing or the photo and the text disagree, ask him.
- Check every new link opens: `curl -sL -o /dev/null -w '%{http_code}\n' "<url>"` must print 200. Use real addresses, never Mailchimp tracking links (`list-manage.com/track/...`).
- Tell him briefly what you changed and why, and ask about anything unclear.

### 3. Lay it out
- Edit `week.json`: put this week's announcements right after `@this-week-header`, newest and most time-sensitive first, each followed by `"---"`. Remove past events (an event whose date has passed must go). Keep the standing parts as they were unless he asks.
- Latest videos: `node scripts/email-builder.mjs videos` lists the newest uploads with their dates; take the ones published since the last email. Usually that's the Thursday Spirits' Book study and the Sunday study. The YouTube titles leave out the book, so add it in front, like `The Spirits' Book: Introduction, Items VIII, IX and X` or `The Gospel According to Spiritism: Blessed Are the Afflicted`. The Sunday book is the one for that Sunday in the rotation. If you're not sure which book a video belongs to, ask.
- `node scripts/email-builder.mjs emails/weeks/<YYYY-MM-DD>/week.json`. Fix every ✗. Fix each ⚠ or tell him about it. If it warns the email is too big for Gmail, suggest taking out the oldest announcement.
- Check the result yourself before showing him: take a screenshot of the preview with headless Chrome (`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=640,9000 --screenshot=<scratch>/shot.png file://<preview.html>`) and look at the top part.

### 4. Preview and approval
- Publish `emails/weeks/<YYYY-MM-DD>/preview.html` with the Artifact tool, titled "Weekly Email <Month D>". Republish the same file after each change so the link stays the same. If the Artifact tool isn't available, run `open <preview.html>` to show it in his browser.
- Send the link with a short list of what's new this week, plus the Sunday line and the two videos, and ask: "Does this look right? Tell me anything you'd like changed."
- Change what he asks, rebuild, republish, and repeat until he says it's good. Only a clear "looks good / approved" counts as approval of this version. If you change anything after that, he has to approve again.

### 5. Put it in Mailchimp and send
1. `node scripts/mailchimp.mjs drafts`. If a draft with exactly this subject already exists and its `made by:` line says Claude, use it. Otherwise run `node scripts/mailchimp.mjs new "<subject>"`.
2. Then follow "Send me a test" and "Send it" in `CLAUDE.md` exactly (fill → check → test → his look at the inbox → dry run → one yes/no question → send). `test` and `send` take the week file too, and refuse if the draft isn't the latest version.
3. If he asks for any change after the test, edit, rebuild, republish the preview, get his approval again, then `fill` again and send a new test before sending.

## If he wants something the email can't do yet
Changing a standing part (for example new Zoom details in the schedule, a new quote, or retiring the podcast) means editing `emails/blocks/<name>.html` or removing it from the list. Removing is fine. For edits to the schedule, Zoom or footer text, make the change, show him the preview, and mention that this changes every future email. Don't redesign the layout. If he asks for a new look, tell him you'll pass it on and stop.
