# Life app

A private, self-hosted app for one person, built with Vite, React, TypeScript, and PocketBase.

- [docs/architecture.md](docs/architecture.md): decisions, server addresses, and the first milestone. Update it when a decision changes.
- [README.md](README.md): how to run everything locally.

## Commands

Run these from `web/`:

- `npm run build`: type-check and build
- `npm run lint`: lint with oxlint
- `npm run dev`: start the dev server. Port 5173 is often taken by another project, so use the port Vite prints.

Run these from `service/`:

- `npm test`: run the tests
- `npm run typecheck`: type-check
- `npm run dev`: start the service. Its credentials are in `service/.env`, which is never committed.

## Rules

- Never put credentials or personal data in Git or the browser. Credentials stay in the TypeScript service.
- Don't send personal data to cloud AI beyond what a request needs.
- The app suggests and the user approves. Don't add actions that run without approval unless the user asks.
- Keep the Tailscale-only access model: no forwarded ports, no public exposure.
- Pin the PocketBase version in `scripts/setup-pocketbase.ps1`, and read the release notes before upgrading.

## UI

- All user-facing text is in Swedish, including labels, messages, and accessibility text. Format dates and numbers with the `sv-SE` locale.
- Add components with `npx shadcn@latest add <name>` from `web/`, and use Lucide for icons.
- Avoid hand-editing `web/src/components/ui/`, because re-applying a shadcn preset overwrites those files.
