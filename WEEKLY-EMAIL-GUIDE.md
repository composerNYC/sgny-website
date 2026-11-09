# Sending the Weekly Schedule email from VS Code

You keep designing the email in Mailchimp, exactly as you do now. The difference is that you ask Claude in VS Code to set up next week's copy, send you a test, and send it, instead of clicking through Mailchimp.

**Nothing is ever sent to the list without you answering "yes" to a final question.**

---

## One-time setup (about 5 minutes, no terminal needed)

**1.** Open the **sgny-website** folder in VS Code (File → Open Folder…), as you usually do.

**2.** Open the Claude panel, paste this message, and press Enter. Claude walks you through the rest, including when to copy the key from the screenshot you were sent.

```
Help me set up sending our weekly "🔵 Weekly Schedule" Mailchimp email from VS Code.
Guide me one step at a time in plain language, and wait for me after each step.

1. Pull the latest changes from GitHub. If I have uncommitted changes, explain what
   they are and ask me what to do before pulling.
2. Check that Node is installed (node -v). If it isn't, walk me through installing the
   LTS version from nodejs.org and wait until I'm done.
3. Read CLAUDE.md and WEEKLY-EMAIL-GUIDE.md and follow them exactly from now on.
4. Run `node scripts/mailchimp.mjs account` to see if my Mailchimp key is set up.
   If not: ask me to open the screenshot of the key I was sent, select the key text
   and press Cmd+C, and to tell you my email address for test emails. Then set it up
   with the clipboard method in CLAUDE.md. Never ask me to paste the key into the chat.
   When it works, remind me to delete the screenshot.
5. Show me the last Weekly Schedule email that was sent. Then ask whether I want to
   start next week's now. If yes, ask me the date, create the draft copy, and give me
   the Mailchimp link to edit it.
6. Finish by telling me my weekly routine in three short lines.

Never send anything to the list unless I answer yes to your final question showing the
subject, the list, and the number of people.
```

**3.** When VS Code asks *"Allow Claude to run this command?"*, click **Allow** (see the note about pop-ups below).

> 🔒 Never type or paste the key itself into the Claude chat, an email, or any file. Copy it to the clipboard when Claude asks, and the setup reads it from there.

**The key expires on November 9, 2027.** Before then, someone makes a new key in Mailchimp (profile picture → **Account & billing** → **Extras** → **API keys** → **Create a key**). You each tell Claude *"Set up my new Mailchimp key from the clipboard"* and copy it when asked.

---

## Every week

Open the Claude panel in VS Code and type these phrases:

| You say | What happens |
|---|---|
| **"Start next week's email"** | Claude asks which date to use, makes a copy of last week's email as a **draft**, and gives you a link to it. |
| *(you edit it in Mailchimp)* | Open the link, update the content, and click Save, as usual. |
| **"It's ready, send me a test"** | Claude checks the email for problems and sends a test to your inbox. |
| *(look at the test in your inbox)* | |
| **"Send it"** | Claude shows the subject, the list and the number of people, then asks: *"Send … to SGNY - General List (311 people)?"* |
| **"Yes"** | It goes out. ✓ |

**About VS Code pop-ups:** sometimes VS Code asks *"Allow Claude to run this command?"* Click **Yes / Allow**. For anything that copies, tests or sends, choose **allow once**, never "always allow."

---

## If something goes wrong

| Claude says | What to do |
|---|---|
| "Not ready" with ✗ items | Fix those items in Mailchimp (Claude explains each one), then say "check again." |
| "Key rejected / expired" | Tell Claude *"Set up my new Mailchimp key from the clipboard"* and copy the new key when asked (see "The key expires" above). |
| "Can't reach Mailchimp" | Check your internet connection and try again. |
| "Already sent an email with this subject" | Change the date in the subject in Mailchimp. This protects against sending twice. |
| Anything else | Ask Claude what it means. Still stuck? Send a screenshot of the message to whoever set this up for you. |

## Please don't
- Click **Upgrade** or change the Mailchimp plan. SGNY is on a special old free plan that can't be restored.
- Share the key, or the file named `.env` in the project folder.
