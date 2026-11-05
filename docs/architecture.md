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
- Navigation is a bottom bar on phones and a sidebar on computers.
- Every section has its own address, handled by React Router (`BrowserRouter` in `web/src/main.tsx`, routes in `web/src/App.tsx`, addresses in `web/src/lib/sections.ts`): `/idag`, `/hem`, `/listor`, `/halsa`, `/ekonomi`, `/mal`, `/mejl`, `/foton`, and `/mer`. Unknown addresses go to `/`. The back button, reload, and links to a page all work, and a link to a page survives signing in.
- `/` redirects to the device's start page, which is Idag unless the device is set to start on Hem. The setting is a switch at the bottom of the Hem page, saved in that browser's `localStorage` only (`web/src/lib/start-page.ts`), so a wall-mounted tablet can open on Hem while a phone keeps Idag. It is a preference, not personal data.
- The wall touch screens are meant to run the app on a Hem page with large touch targets. A kiosk-style layout for them isn't built yet.
- Caddy serves `index.html` for any path that isn't `/api`, `/_`, or `/service`, so these addresses work when opened directly. No route may start with one of those three.
- The current Today screen is a prototype using sample data, except the lights panel, the daily to-do list, and the database status.

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

The goal is an organized inbox and a digest of what matters, not a mail client and not AI replies. Phase A is built: reading, sorting by rules, and showing the result. It is read-only.

- **Connection.** The service signs in to Gmail over IMAP with an app password (`service/src/mail/gmail-source.ts`) and keeps the connection open, so Gmail reports new mail at once with no public address needed. A refresh every 5 minutes is a safety net. A wrong password is not retried, to avoid a lockout. The IMAP route was chosen over the Gmail API because there's no 7-day login expiry and no Google Cloud project. The limit on what the app can do is enforced in the service: it only has read functions, and later archive and move to trash, never permanent delete or send.
- **Storage.** The sync engine (`sync.ts`) mirrors the last 30 days of the inbox, at most 300 messages, into the PocketBase `mails` collection, adding new mail, updating read state, and removing what left the inbox. Only a snippet of about 400 characters is stored, never the full message, and none at all for sensitive mail. PocketBase's rate limiter allows only 20 creates per 5 seconds, so the store spaces creates about 350 ms apart and waits and retries on a 429 answer. The first sync of a full inbox therefore takes a couple of minutes, once. The service writes as its own PocketBase user, `service@life-app.local`, which the collection rules allow to change mail and nothing else. Signed-in users can read it.
- **Sorting without AI.** `classify.ts` sorts mail into Viktigt, Fakturor, Leveranser, Bokningar, Övrigt, Nyhetsbrev, and Reklam from headers (`List-Unsubscribe`, `List-Id`, `Precedence`, `Auto-Submitted`), the sender, and keywords in the subject. Mail from a person with no bulk headers counts as important. The keyword lists are plain data at the top of the file.
- **Sensitive mail.** Login codes, password resets, and mail from banks and authorities are flagged `sensitive`. They keep no snippet, and they must never be sent to any AI.
- **The app.** The Mejl page lists the buckets, and the Post panel on Idag shows unread mail in Viktigt, Fakturor, Leveranser, and Bokningar. Each message links to Gmail, since reading and replying happen there. The pages update live when PocketBase reports a change.
- **Not built yet.** Phase B: Arkivera and Ta bort (move to Trash, which Gmail empties after 30 days), with bulk suggestions in Att godkänna, and teaching the app a sender's bucket. Phase C: a small AI step for unknown senders and for reading out invoice amounts, due dates, and delivery days, with a daily cap on requests and a never-send list. It starts with the rules above, so only what they can't place goes to Claude.
- **Tested.** The rules, the sync, the PocketBase store, and the status endpoint have tests. The connection to Gmail itself hasn't been tested against a real mailbox yet.

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
