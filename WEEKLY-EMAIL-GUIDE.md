# Making and sending the Weekly Schedule email from VS Code

You don't design anything in Mailchimp anymore. Each week you give Claude the flyers, photos and text. Claude checks them, lays out the email in the usual look, and shows you a preview. Once you approve it, Claude puts it in Mailchimp, sends you a test, and sends it.

**Nothing is ever sent to the list without you answering "yes" to a final question.**

---

## One-time setup (about 5 minutes, no terminal needed)

**1.** Open the **sgny-website** folder in VS Code (File → Open Folder…), as you usually do.

**2.** Open the Claude panel, paste this message, and press Enter. Claude walks you through the rest.

```
Help me set up the weekly "🔵 Weekly Schedule" email in VS Code.
Guide me one step at a time in plain language, and wait for me after each step.

1. Pull the latest changes from GitHub. If I have uncommitted changes, explain what
   they are and ask me what to do before pulling.
2. Check that Node is installed (node -v). If it isn't, walk me through installing the
   LTS version from nodejs.org and wait until I'm done.
3. Read CLAUDE.md and the weekly-email skill and follow them exactly from now on.
4. Run `node scripts/mailchimp.mjs account` to see if my Mailchimp key works.
   If not: ask me to open the screenshot of the key I was sent, select the key text
   and press Cmd+C, and to tell you my email address for test emails. Then set it up
   with the clipboard method in CLAUDE.md. Never ask me to paste the key into the chat.
   When it works, remind me to delete the screenshot.
5. Finish by telling me my weekly routine in three short lines.

Never send anything to the list unless I answer yes to your final question showing the
subject, the list, and the number of people.
```

**3.** When VS Code asks *"Allow Claude to run this command?"*, click **Allow** (see the note about pop-ups below).

> 🔒 Never type or paste the key itself into the Claude chat, an email, or any file. Copy it to the clipboard when Claude asks, and the setup reads it from there.

**The key expires on November 9, 2027.** Before then, someone makes a new key in Mailchimp (profile picture → **Account & billing** → **Extras** → **API keys** → **Create a key**). Tell Claude *"Set up my new Mailchimp key from the clipboard"* and copy it when asked.

---

## Every week

Open the Claude panel in VS Code and talk to Claude normally:

| You | What happens |
|---|---|
| **"Let's do next week's email"** | Claude asks which date goes in the subject and opens a folder for this week. |
| *Drag the flyers and photos into that folder, then type the text for each announcement in the chat* | Say also what to take out from last week. Claude checks spelling, dates and times, and asks about anything missing. |
| *Open the preview link Claude gives you* | Ask for any changes in your own words ("move the talk to the top", "bigger photo"). Claude updates the same link. |
| **"Looks good"** | Claude puts it in Mailchimp and sends a test to your inbox. |
| *Look at the test in your inbox* | If something needs changing, say so. Claude fixes it and sends a new test. |
| **"Send it"** | Claude asks: *"Send … to SGNY - General List (311 people)?"* |
| **"Yes"** | It goes out. ✓ |

**About VS Code pop-ups:** sometimes VS Code asks *"Allow Claude to run this command?"* Click **Yes / Allow**. For anything that tests or sends, choose **allow once**, never "always allow."

---

## If something goes wrong

| Claude says | What to do |
|---|---|
| "Key rejected / expired" | Tell Claude *"Set up my new Mailchimp key from the clipboard"* and copy the new key when asked (see "The key expires" above). |
| "Can't reach Mailchimp" or "Couldn't reach YouTube" | Check your internet connection and try again. |
| "Already sent an email with this subject" | Check the date in the subject. This protects against sending twice. |
| "The draft is not the latest approved version" | Normal after a change. Claude updates the draft and sends a new test. |
| Anything else | Ask Claude what it means. Still stuck? Send a screenshot of the message to whoever set this up for you. |

## Please don't
- Click **Upgrade** or change the Mailchimp plan. SGNY is on a special old free plan that can't be restored.
- Edit the weekly email by hand in Mailchimp. Ask Claude for changes instead, so the preview, the test and the email stay the same.
- Share the key, or the file named `.env` in the project folder.
