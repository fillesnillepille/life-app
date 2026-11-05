# Life app

A private, self-hosted app for one person. See [docs/architecture.md](docs/architecture.md) for the decisions behind it.

## Run it locally

Download the pinned PocketBase version, which only needs doing once or after changing the version in the script:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-pocketbase.ps1
```

Start PocketBase. Its admin UI is at `http://127.0.0.1:8090/_/`, and it applies new migrations from `pocketbase/pb_migrations` on start:

```bash
pocketbase/pocketbase.exe serve --dir pocketbase/pb_data --migrationsDir pocketbase/pb_migrations
```

Public sign-up is closed, so create your login account by hand: in the admin UI, open **Collections > users > New record**, and enter an email and password. This is separate from the admin account.

Set up the service once. Copy `service/.env.example` to `service/.env`, then in Home Assistant go to **Profile > Security > Long-lived access tokens**, create a token, and set it as `HOME_ASSISTANT_TOKEN` in `service/.env`. Restart the service after changing that file. Never commit it or share the token.

In a second terminal, start the service:

```bash
npm run dev --prefix service
```

In a third terminal, start the web app:

```bash
npm run dev --prefix web
```

The web app reaches the service through Vite's `/service` proxy.

Vite prints the address it's using, which is normally `http://localhost:5173`.
