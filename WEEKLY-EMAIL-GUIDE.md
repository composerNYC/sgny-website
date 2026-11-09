# Sending the Weekly Schedule email from VS Code

You keep designing the email in Mailchimp, exactly as you do now. The difference is that you ask Claude in VS Code to set up next week's copy, send you a test, and send it, instead of clicking through Mailchimp.

**Nothing is ever sent to the list without you answering "yes" to a final question.**

---

## One-time setup (about 10 minutes)

**1. Get the latest website files.**
In VS Code, click the **Source Control** icon on the left (the branching-lines icon), then click **Sync Changes**. (Or ask Claude: *"Pull the latest changes from GitHub."*)

**2. Check that Node is installed.**
Open the terminal: menu **Terminal → New Terminal**. Type `node -v` and press Enter.
- If you see something like `v22.11.0`, you're good.
- If you see "command not found," download the **LTS** version from [nodejs.org](https://nodejs.org), install it, then close and reopen VS Code.

**3. Copy the Mailchimp key from the screenshot you were sent.**
Open the screenshot on your Mac and hover over the key. You can select the text right in the image (macOS does this automatically), then press **Cmd+C**.
It's a long string of letters and numbers ending in **`-us10`**. Copy all of it.

**4. Save the key on your computer.**
In the VS Code terminal, type `npm run mail:setup` and press Enter.
- Paste the key (**Cmd+V**) and press Enter. **It stays invisible while you paste; that's normal.**
- Type your email address (test emails go there) and press Enter.
- When you see **"✓ Key works"** and **"All set!"**, you're done.
- If it says the key doesn't look right, a character was probably missed. Copy it again and re-run `npm run mail:setup`.

**5. Delete the screenshot** from your messages and photos once setup works. The key is now saved safely on your computer.

> 🔒 **Never paste the key into the Claude chat, an email, or any file.** Only into `npm run mail:setup`.

**The key expires on November 9, 2027.** Before then, someone makes a new key in Mailchimp (profile picture → **Account & billing** → **Extras** → **API keys** → **Create a key**), and you each run `npm run mail:setup` again with it.

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
| "Key rejected / expired" | A new key is needed (see "The key expires" above). Run `npm run mail:setup` with the new key. |
| "Can't reach Mailchimp" | Check your internet connection and try again. |
| "Already sent an email with this subject" | Change the date in the subject in Mailchimp. This protects against sending twice. |
| Anything else | Ask Claude what it means. Still stuck? Send a screenshot of the message to whoever set this up for you. |

## Please don't
- Click **Upgrade** or change the Mailchimp plan. SGNY is on a special old free plan that can't be restored.
- Share the key, or the file named `.env` in the project folder.
