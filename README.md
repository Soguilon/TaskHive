# TaskHive — Setup Guide

TaskHive's frontend (HTML/CSS/JS/Bootstrap) is complete and calls a Google Apps Script
backend that reads/writes a Google Sheet. Two things only Google can do — creating the
Sheet and deploying the script — need to happen in **your** Google account. Everything
else (all the UI logic, CRUD, task workflow, calendar, etc.) is already written and wired up.

## 1. Create the Google Sheet
1. Go to sheets.google.com → Blank spreadsheet. Name it "TaskHive Database".
2. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`

## 2. Add the backend script
1. In the sheet, go to **Extensions → Apps Script**.
2. Delete the default code, paste in the full contents of `google-apps-script/Code.gs`.
3. Replace `PUT_YOUR_SPREADSHEET_ID_HERE` at the top with the ID from step 1.
4. Save (Ctrl/Cmd+S).

## 3. Build the sheets automatically
1. In the Apps Script editor, pick `setupSheets` from the function dropdown at the top.
2. Click **Run**. Grant the permissions it asks for (it needs access to the Sheet).
3. Check the spreadsheet — you should now see 12 tabs (Admin, Members, Projects, Tasks,
   Calendar, Notes, Discussions, Meetings, ActivityLogs, Archive, Trash, Notifications)
   with headers, and one Admin row (`Sugoi` / `54601`).

## 4. Deploy as a Web App
1. In Apps Script, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → **Web app**.
3. Set:
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Click **Deploy**, authorize again if prompted.
5. Copy the **Web app URL** it gives you (ends in `/exec`).

## 5. Point the frontend at your deployment
1. Open `assets/js/api.js`.
2. Replace `PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE` with the URL from step 4.
3. Save.

## 6. Run it
Open `index.html` in a browser (or host the whole folder on any static host — Netlify,
GitHub Pages, Apps Script itself, etc.). Log in as admin with `Sugoi` / `54601`, add a
member, and you're off.

### Notes
- Every button, modal, and workflow described in the spec (task checkbox → submit →
  approve/needs-revision, progress auto-calc, archive/trash/restore, notifications,
  activity log, discussions, calendar with day notes, global search) reads and writes
  the Sheet through `Code.gs` — nothing is hardcoded or faked.
- If you ever change the sheet schema, re-run `setupSheets()` on a **fresh** spreadsheet
  (it clears sheets it touches) — don't run it on a sheet with real data you want to keep.
- Whenever you edit `Code.gs` after the first deployment, use **Deploy → Manage
  deployments → Edit (pencil) → New version** so the live `/exec` URL picks up your changes.
