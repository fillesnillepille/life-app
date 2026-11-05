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

PWA installs and phone notifications need HTTPS, which Tailscale can provide with a private address and a trusted certificate when the first version is deployed.

## Design

- A dense, technical, terminal-style command center. Dark mode only.
- shadcn/ui Lyra style with square corners, Geist Mono, and orange as the accent and chart color.
- The app opens on a Today overview with approvals first.
- Navigation is a bottom bar on phones and a sidebar on computers.
- The current Today screen is a prototype using sample data. Nothing on it is connected yet, except the database status.

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
