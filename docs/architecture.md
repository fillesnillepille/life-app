# Life app architecture

A private, self-hosted app for one person. It brings time and tasks, health, money, goals and habits, home control, and a Google-based digital life (mail, calendar, photos) into one place. It acts as a dashboard, coach, automation tool, and source of insights.

## Decisions

| Area                  | Decision                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| Web app               | Vite, React, and TypeScript, installable on a phone as a PWA                               |
| Data, login, realtime | PocketBase, which can also serve the built web app                                         |
| Integrations          | A separate TypeScript service on Node, which holds all credentials and runs scheduled jobs |
| Home control          | Home Assistant is the source of truth for devices and their history                        |
| AI                    | Cloud AI (Claude), receiving only the data each request needs                              |
| Hosting               | The user's own hardware                                                                    |
| Remote access         | Tailscale only, with no ports forwarded and no Tailscale Funnel                            |

```text
Phone / computer (over Tailscale when away)
        |
   Web app (Vite + React)
        |
   PocketBase -- login, data, realtime updates
        |
   TypeScript service -- Home Assistant -> Hue, Govee, TV
                      -- Google -> mail, calendar
                      -- Garmin -> training, sleep, health (read-only)
                      -- Claude -> coach, suggestions
                      -- scheduled syncs and reminders
```

## Approval rule

For now, the app suggests and the user approves. Autonomy will be revisited later.

1. The service or AI writes a proposed action to a PocketBase collection.
2. It appears in the app straight away through realtime updates.
3. The user approves or rejects it, and that decision is saved.
4. The service carries out approved actions and logs the result.

Tapping a light control directly counts as approval, so it needs no extra step.

## Rules

- Credentials stay in the TypeScript service and never reach the browser or Git.
- Personal data lives only in PocketBase and its backups, never in Git.
- PocketBase API rules are locked down from the start, even with one user.
- Pin the PocketBase version and read the release notes before upgrading.
- Photos stay out of PocketBase, apart from metadata. A dedicated tool such as Immich can be added later.
- A USB backup drive must be in place, with a tested restore, before personal data goes on the server.

## Server

An HP ProBook 440 G6 (16 GB RAM, 4 cores, 256 GB SSD) running Proxmox.

| Service                 | Address                     | Notes                                                  |
| ----------------------- | --------------------------- | ------------------------------------------------------ |
| Proxmox                 | `https://192.168.1.10:8006` | Also the Tailscale subnet router for .10, .11, and .12 |
| Home Assistant (VM 100) | `http://192.168.1.11`       | Uses port 80, not the usual 8123                       |
| App (VM 101)            | `192.168.1.12`              | Debian 13 with Docker, SSH as user `app`               |

The router's DHCP pool is 192.168.1.64-253, and it has no reservation option, so these addresses are set statically below that range.

PWA installs and phone notifications need HTTPS. The app VM has Tailscale installed and runs `tailscale serve --bg 8080`, which gives it HTTPS at `https://app.tail135add.ts.net/` with a trusted certificate, reachable only from devices on the tailnet. The hostname is published in public certificate transparency logs, which reveals nothing beyond the name.

## Deployment

Docker Compose on the app VM (`deploy/docker-compose.yml`) runs three containers: PocketBase, the TypeScript service, and Caddy. Caddy serves the built web app and proxies `/api` and `/_` to PocketBase and `/service` to the service, so everything shares one address and needs no CORS rules. It listens only on the VM's `127.0.0.1:8080`, and `tailscale serve` sits in front of it. PocketBase data is in `deploy/data/pb_data` on the VM, which is not in Git. The service reads its Home Assistant token from `service/.env` on the VM. The README has the steps.

The web app is installable as a PWA through `web/public/manifest.webmanifest`. The icon is the SVG favicon, so iPhones may need a PNG icon added later.

The PocketBase version is pinned in two places, `scripts/setup-pocketbase.ps1` for Windows and `deploy/pocketbase.Dockerfile` for the VM. Keep them the same.

## Design

- Dark mode only, and pure black so it looks right on OLED screens: the background, cards, and sidebar are `oklch(0 0 0)`, text is white, and the accent is grayscale. Surfaces are separated by thin white borders at low opacity rather than lighter fills.
- shadcn/ui Nova style (`base-nova`) with rounded corners and the Geist font. Apply style changes with `npx shadcn@latest apply`, and keep hand-built boxes such as `Panel` rounded to match the Card component.
- The app opens on a Today overview with approvals first.
- Navigation is a bottom bar on phones and a sidebar on computers. The bottom bar holds Idag, Schema, Hem, Listor, Hälsa, Ekonomi, Mejl, and Mer (the list is `bottomBarIds` in `web/src/lib/sections.ts`), and Mer leads to the rest. The selected tab grows to show its label while the others show only an icon, and a bar slides along the top edge to it. The motion is turned off when the device asks for reduced motion.
- Every section has its own address, handled by React Router (`BrowserRouter` in `web/src/main.tsx`, routes in `web/src/App.tsx`, addresses in `web/src/lib/sections.ts`): `/idag`, `/schema` (with `?vy=dag|vecka&datum=2026-11-06`), `/schema/skift` (shift types and the cycle), `/hem`, `/listor`, `/halsa`, `/ekonomi`, `/ekonomi/manad/:month` (one month's figures), `/mal`, `/mejl`, `/mejl/:uidValidity/:uid` (one message), `/foton`, and `/mer`. Unknown addresses go to `/`. The back button, reload, and links to a page all work, and a link to a page survives signing in.
- `/` redirects to the device's start page, which is Idag unless the device is set to start on Hem. The setting is a switch at the bottom of the Hem page, saved in that browser's `localStorage` only (`web/src/lib/start-page.ts`), so a wall-mounted tablet can open on Hem while a phone keeps Idag. It is a preference, not personal data.
- The wall touch screens are meant to run the app on a Hem page with large touch targets. A kiosk-style layout for them isn't built yet.
- Caddy serves `index.html` for any path that isn't `/api`, `/_`, or `/service`, so these addresses work when opened directly. No route may start with one of those three.
- The current Today screen is a prototype using sample data, except the lights panel, the daily to-do list, the schedule panel, the day grading prompt, the mail panel, the money reminder, and the database status.

## Service

- The browser never talks to Home Assistant. It calls the TypeScript service with its PocketBase token, and the service checks that token before using its own Home Assistant credentials.
- In development, Vite proxies `/service` to the service, which listens only on 127.0.0.1. In production, Caddy proxies `/service` on the same origin, so no CORS rules are needed (see Deployment).
- Development can use the real database: set `VITE_POCKETBASE_URL` in `web/.env.local` and `POCKETBASE_URL` in `service/.env` to the VM's address. Dev then changes real data, and needs the VM running and Tailscale on.
- Lights update by polling every 5 seconds while the app is visible. Home Assistant's WebSocket API could replace this later.

## To-do lists

The "Listor" page (`web/src/pages/tasks-page.tsx`) has four lists in one PocketBase collection, `todos`, which a migration creates (`pocketbase/pb_migrations/1793900000_create_todos.js`). A second migration adds the shopping list. Each item has a `title`, a `list` (`daily`, `longterm`, `bucket`, or `shopping`), `done`, `doneAt`, and the owning `user`. The API rules let a user list, change, and delete only their own items, and create only items owned by themselves.

Every item shows when it was added, and when it was finished if it is. Open items come first, and finished ones go below them under "Klara uppgifter". Dates use the `sv-SE` format, and the daily list also shows the time of day.

- **Dagligt:** things to do today. Finished items stay saved, but the list shows only what was finished today, so it starts fresh each morning. Unfinished items carry over, and a red "!" marks any open item added more than 24 hours ago.
- **Långsiktigt:** tasks with no time limit.
- **Bucket list:** things to do someday.
- **Inköp:** the shopping list. Finished items are called "Köpta" and show "Köpt" with the date.

The list code lives in `web/src/components/todo-list.tsx`, with the list definitions in `web/src/lib/todo-lists.ts`. The Today page shows the daily list through `DailyTodosPanel`, and it is the same data as the Dagligt tab, so adding or ticking an item in one place shows in the other after a reload.

Deleting an item asks for confirmation first, in a dialog (the shadcn `AlertDialog`).

The browser talks to PocketBase directly for these, with no service involved, since nothing here needs credentials. Changes show at once and are rolled back with an error message if saving fails. There is no realtime sync yet, so a second device sees changes after a reload.

## Mail

The goal is an organized inbox and a digest of what matters, not a mail client and not AI replies. Phase A is built: reading, sorting by rules, and showing the result. Part of phase B is built too: opening a message in the app, marking it read, and moving it to Trash.

- **Connection.** The service signs in to Gmail over IMAP with an app password (`service/src/mail/gmail-source.ts`) and keeps the connection open, so Gmail reports new mail at once with no public address needed. A refresh every 5 minutes is a safety net. A wrong password is not retried, to avoid a lockout. The IMAP route was chosen over the Gmail API because there's no 7-day login expiry and no Google Cloud project. The limit on what the app can do is enforced in the service: it can read a message, mark it as read, and move it to Trash, and it has no function for permanent delete or sending. The routes are `GET /mail/messages/:uidValidity/:uid` and `POST` to `.../seen` and `.../trash`. A message is named by the mailbox's validity number and its UID, and an old pair after a mailbox reset counts as gone.
- **Storage.** The sync engine (`sync.ts`) mirrors the last 30 days of the inbox, at most 300 messages, into the PocketBase `mails` collection, adding new mail, updating read state, and removing what left the inbox. Only a snippet of about 400 characters is stored, never the full message, and none at all for sensitive mail. PocketBase's rate limiter allows only 20 creates per 5 seconds, so the store spaces creates about 350 ms apart and waits and retries on a 429 answer. The first sync of a full inbox therefore takes a couple of minutes, once. The service writes as its own PocketBase user, `service@life-app.local`, which the collection rules allow to change mail and nothing else. Signed-in users can read it.
- **Sorting without AI.** `classify.ts` sorts mail into Viktigt, Koder, Fakturor, Leveranser, Bokningar, Övrigt, Nyhetsbrev, and Reklam (the order the Mejl page shows them in) from headers (`List-Unsubscribe`, `List-Id`, `Precedence`, `Auto-Submitted`), the sender, and keywords in the subject. Mail from a person with no bulk headers counts as important. So do account security notices (new sign-ins, suspicious activity, a changed password) from any service, and everything from a few senders that are always worth reading: Google account security, Apple ID, Microsoft account protection, and Kivra. Those come before the other rules, except that a one-time code from them still goes to Koder. Kivra is also marked sensitive. The keyword and sender lists are plain data at the top of `classify.ts`, so adding a sender means adding one line.
- **Codes and sensitive mail.** One-time codes, login links, and password resets go in their own bucket, Koder, checked before every other rule. Mail from banks and authorities keeps its normal bucket. Both are flagged `sensitive`: no snippet is kept, and they must never be sent to any AI.
- **The app.** The Mejl page lists the buckets, each message with a delete button, and the Post panel on Idag shows unread mail in Viktigt, Fakturor, Leveranser, and Bokningar. The pages update live when PocketBase reports a change.
- **Reading a message.** A message opens in the app at `/mejl/:uidValidity/:uid`. Its full text is fetched from Gmail when the page opens and passed on to the browser, and is never stored. Plain text is shown by default, with web links made clickable. If the message has HTML, "Originalutseende" shows it. Opening a message marks it as read. Attachments are listed but not downloaded, and each message has an "Öppna i Gmail" button.
- **Mail HTML is untrusted.** It is cleaned with DOMPurify (scripts, forms, embedded frames, event handlers, and `javascript:` links are removed), and then shown in a sandboxed `iframe` (`sandbox` without `allow-scripts`) with a content security policy of `default-src 'none'`. Images from the internet are blocked until you press "Visa bilder", because loading one tells the sender the mail was read. Both layers are meant to hold on their own. The code is in `web/src/lib/mail-html.ts` and `web/src/components/mail-content.tsx`.
- **Deleting.** "Ta bort" asks first, then moves the message to Gmail's Trash, which Gmail empties after 30 days, so a mistake can be undone there. It is never deleted permanently. Pressing the button counts as approval, like tapping a light.
- **Not built yet.** Archiving, bulk suggestions in Att godkänna, and teaching the app a sender's bucket. Phase C: a small AI step for unknown senders and for reading out invoice amounts, due dates, and delivery days, with a daily cap on requests and a never-send list. It starts with the rules above, so only what they can't place goes to Claude.
- **Tested.** The rules, the sync, the PocketBase store, and the routes have tests. The pages were tried in a browser against a fake mailbox, including a deliberately hostile HTML message. Reading, marking as read, and moving to Trash on a real Gmail mailbox are untested until they are tried with your account.

## Money

The Ekonomi page tracks a few figures a month, typed in by hand. A Google Sheet was considered, but reading it would need a Google Cloud service account, and a published sheet would be public, so hand entry won.

- **Data.** One PocketBase record per month in `finance_months` (migration `1793940000_create_finance_months.js`): `month` as text (`2026-11`), `expenses` (spent during the month), `savings` (savings balance at month end), `investments` (market value at month end), `deposited` (put into investments during the month, negative for withdrawals, 0 if not given), a `note`, and the owning `user`. A user and month pair is unique. The rules match the to-do lists: only the owner can see or change their months. The browser talks to PocketBase directly, since no credentials are involved.
- **Overview** (`web/src/pages/money-page.tsx`). Three figures at the top (total, investments, and the latest month's expenses), then charts: the total of savings and investments as a green area, investments as a blue line, expenses as red bars with a dashed average line, and a donut of savings against investments for the latest month. A table of every month underneath is the numbers behind the charts and the way to edit an old month. Past 12 months, a switch shows either the last 12 or all of them. Once any month has a deposit filled in, the investments figure shows the month's return (change in value minus deposits) instead of the plain change.
- **Entering a month** (`web/src/pages/money-month-page.tsx`). `/ekonomi/manad` opens the month that's due, and `/ekonomi/manad/2026-10` opens that month, pre-filled if it's already saved. Each field shows last month's figure as a hint. Amounts take spaces and a decimal comma and are stored in whole kronor. A saved month can be deleted after a confirmation.
- **Reminder.** From the 25th the current month is due, and before that the previous month is. If the due month isn't saved, a reminder with a button to the entry page shows at the top of Idag and Ekonomi. It's in the app only, since the app has no push notifications yet.
- **Charts** use the shadcn `chart` component (Recharts). The colours are tokens in `web/src/index.css` (`--finance-expenses`, `--finance-investments`, `--finance-total`), checked for contrast on the black background. Blue and green also stay apart for colour-blind readers. Red and green don't, so they never share a chart. Both Ekonomi pages are loaded only when opened, because Recharts is large.
- **Tested.** Tried in a browser against a local PocketBase with sample months: the charts, tooltips, the reminder on Idag, validation, saving, deleting, and phone width.

## Schedule

The Schema page (`web/src/pages/schedule-page.tsx`) shows the user's shifts and plans, with a switch between Dag and Vecka (Monday to Sunday). The browser talks to PocketBase directly, since no credentials are involved. The date logic and the cycle are in `web/src/lib/schedule.ts`.

- **Data.** Four collections, from migration `1793950000_create_schedule.js`, each owned by one user with the same rules as the to-do lists. `shift_types` holds a name, a start and end time as `"07:00"` text, and a colour from a fixed set. `shift_cycles` holds one record per user: `startDate`, the Monday of week 1, and `days`, 35 shift type ids, where an empty string is a day off. `shift_overrides` changes a single date to another shift, or to Ledig, Semester, or Sjuk. `schedule_entries` holds a title, a date, either `allDay` or a start and end time, and an optional link to a `todos` item. Dates are `"2026-11-06"` text so there are no time zone shifts.
- **The cycle.** The shift on a date is the date's override if there is one, otherwise day `(date - startDate) mod 35` of the cycle. A shift whose end is at or before its start runs past midnight. It belongs to the day it starts, and the timeline shows it running into the next morning. Entries follow the same rule.
- **Times are always 24-hour.** The browser's own time input follows the device's clock setting and can show AM/PM, so times are typed in `TimeField` (`web/src/components/time-field.tsx`), a text field that takes `14:00`, `1400`, `14.00`, or `9` and tidies them to `HH:MM`.
- **Shift colours** are tokens in `web/src/index.css` (`--shift-blue` and so on). Red and green are left out, since red means expenses in Ekonomi.
- **Setting it up** (`web/src/pages/shift-cycle-page.tsx`, at `/schema/skift`). Shift types are added and changed in a dialog. The cycle is a 5 × 7 grid: pick a shift, then tap the days to set them, and save. Deleting a shift type clears it from the cycle, and PocketBase removes the overrides that used it.
- **Views.** Dag shows the whole day as an hour timeline that scrolls with the page. The shift is a coloured band across its full width, labelled in its bottom corner, with entries as blocks on top, side by side where they overlap, and a line for the current time. All-day entries sit above. Vecka shows seven timeline columns on a computer and one row per day on a phone. "Ändra dag" opens the override dialog.
- **Links to Listor.** An entry can link to an existing item, or create a new item in a chosen list. A linked entry shows the item's title and shares its done state, so ticking it in either place ticks both. Each open item in Listor has a "Schemalägg" button, which opens Schema with the add dialog and the item picked (`?schemalagg=<id>`), and the item shows when it's scheduled. Deleting an entry leaves the item alone. Deleting the item keeps the entry with its own copy of the title.
- **Idag** has a Schema panel with today's and tomorrow's shift, a night shift from yesterday that's still going, and today's entries, which can be ticked. It shares its list data with the daily to-do panel, so ticking in one updates the other.
- **Loading.** Everything is loaded at once, since one person's shifts and plans stay small. Entries for several years may call for loading by date range later.

## Day grades

Each day can be graded 1-5 in a few areas, and the average becomes a smiley.

- **Data.** One record per user and date in `day_ratings` (migration `1793960000_create_day_ratings.js`): `work`, `exercise`, `food`, `social`, `creativity`, and `general`, plus `worked` and an optional `comment`. `work` is 0 on days without work. The owner-only rules match the other collections.
- **The prompt** (`web/src/components/day-rating-prompt.tsx`). From 19:00 Idag asks "Hur var dagen?" until today is graded. If yesterday was missed, it asks about yesterday until then. Arbete is included when Schema has a shift that day, including an override. On other days a "Jobbade idag" switch adds it. Every grade that applies must be set, and the comment is optional.
- **Editing.** Only today and yesterday can be graded or changed, so a day isn't re-graded weeks later from memory. Schema's day view has a button for this. The limit is in the app only, not in the PocketBase rules.
- **Average and smiley** (`web/src/lib/day-rating.ts`). The weighted mean of the grades given, with Allmänt counting double. The average rounds to one of five Lucide faces, from Frown to Laugh. Past days in Schema show their smiley, and the average is in its label. Neither is stored.
- **Hälsa** (`web/src/pages/health-page.tsx`, loaded only when opened). The day grades come first, then the Garmin sections (see Garmin). It has averages for the last week, the period, and the latest day, and a range switch for 30 days, 90 days, or everything. The charts are the daily average as dots with a 7-day rolling line, each area's average for the period, one chosen area over time, and a month calendar where brighter means a better day. Tapping a calendar day opens it in Schema. The charts use one colour, `--rating`, from dim to bright, so they read without telling red from green.
- **AI.** Comments are personal data and are never sent to an AI unless that is built and asked for.
- **Tested** in a browser against a throwaway local PocketBase with sample shifts and grades: grading on Idag, the average, linking and ticking entries both ways, scheduling from Listor, overrides, the cycle editor, the charts, and phone width.

## Garmin

Training, sleep, and health data from Garmin Connect, shown in Hälsa, Schema, and Idag. Strava was the first idea, but Garmin's Personal API (opened to individuals in October 2026) is free, needs no approval, and has sleep and health data as well as activities.

- **Connection.** The service reads Garmin's Personal API with a personal API key from Garmin Connect (`service/src/garmin/garmin-source.ts`). The key is swapped for an access token that lasts 24 hours, and there are no refresh tokens, so the service fetches a new one with the key. The key lasts at most a year. Its expiry date goes in `GARMIN_API_KEY_EXPIRES`, and from two weeks before it Hälsa and Idag show a reminder. Garmin only answers requests, with no push, so nothing needs a public address. The service has no function that changes anything at Garmin.
- **What's read.** Activity summaries (`/activitylist-service/activities/search/activities`), daily summaries (`/usersummary-service/v2/dailysummaries`), sleep (`/sleep-service/sleep/dailySleepSummariesByDate`), and HRV (`/hrv-service/hrv/daily`). Ranges are split into 28-day pieces, and requests are spaced half a second apart. Garmin's Swagger page lists the rest, including weight, which can be added if a scale comes along.
- **Storage.** Two collections from migration `1793970000_create_garmin.js`, written only by the service user and readable by signed-in users, like `mails`. `garmin_activities` holds one summary per activity: type, local date and start time, durations, distance, elevation, heart rate, calories, and speed. No routes, GPS, or second-by-second data. `garmin_days` holds one record per date: the night's sleep that ends on it (duration, stages, score, times), HRV, resting heart rate, steps, stress, Body Battery, active calories, and intensity minutes. Missing numbers are 0. Days with no data, or only a step goal, aren't stored.
- **Sync** (`service/src/garmin/sync.ts`). Every hour, and from "Synka nu" in Hälsa (`POST /garmin/sync`). The first sync takes every activity and up to a year of days. After that it re-reads the last 30 days of activities and the last 7 days of days, or further back if the service was off, so late sleep data and edits arrive. Activities deleted at Garmin are removed if they fall in the range just read. Days are never removed. Dates are local to `GARMIN_TIME_ZONE` (Europe/Stockholm). If Garmin refuses the key, the hourly sync stops until the service restarts or "Synka nu" is pressed.
- **Hälsa.** Träning has the week and the period in figures, training time per week or month, each sport's totals, and the activities, each linking to its day in Schema. Sömn och återhämtning has last night's sleep, HRV, resting heart rate, and today's steps, a sleep chart, and one chosen measure over time. Samband compares the day grades on training and rest days, and after short and long nights, counting only days Garmin has data for. The 30 dagar, 90 dagar, and Allt switch at the top covers all of it. The code is in `web/src/components/training-section.tsx`, `recovery-section.tsx`, and `health-insights.tsx`, with the sums and labels in `web/src/lib/garmin.ts`.
- **Schema** shows activities as orange blocks on the timeline with the sport's icon, and in the week list on phones. They can't be changed there.
- **The Träning grade.** When a day is graded, Träning is picked in advance from that day's training time: none is 1, under 20 minutes 2, under 45 minutes 3, under 90 minutes 4, and longer 5 (`exerciseGradeLimits` in `web/src/lib/garmin.ts`). It can be changed like any grade, and it's only suggested for days Garmin has data for and that aren't graded yet.
- **Not training.** Breathing exercises and meditation are listed but left out of training time, the grade, and training days.
- **Idag** shows last night's sleep and today's steps, and the key reminder.
- **Colours.** `--activity` (orange) for training and `--sleep` (light blue) for sleep and recovery, in `web/src/index.css`. Neither is red or green, and no chart uses both.
- **AI.** Garmin data is never sent to an AI. Garmin's developer terms are also reported to forbid it.
- **Tested.** The service has tests for the conversion, the token handling and paging, the sync, and the routes. It was also tried against the real Personal API with a throwaway local PocketBase: a real sync, Hälsa, Schema's day and week views, the suggested grade, Idag, and phone width.

## Lighting

- Philips Hue bulbs connect through a standard Hue Bridge, using Home Assistant's Hue integration. The Bridge hasn't arrived yet.
- Govee lights, if added, should support Matter or LAN control. Avoid Bluetooth-only models.

## First milestone

Control Hue lights and scenes from the app, through Home Assistant, including from a phone away from home.

1. Server, Home Assistant, app VM, and Tailscale (done).
2. Connect the Hue Bridge to Home Assistant.
3. Build the app's foundation, including login.
4. Add a page for controlling lights and scenes.

Mail, calendar, and the other areas plug into that foundation afterward, one at a time.
