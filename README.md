# Life app

A private, self-hosted app for one person. See [docs/architecture.md](docs/architecture.md) for the decisions behind it.

## Run it locally

Download the pinned PocketBase version, which only needs doing once or after changing the version in the script:

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-pocketbase.ps1
```

Start PocketBase. Its admin UI is at `http://127.0.0.1:8090/_/`:

```bash
pocketbase/pocketbase.exe serve --dir pocketbase/pb_data --migrationsDir pocketbase/pb_migrations
```

In a second terminal, start the web app:

```bash
npm run dev --prefix web
```

Vite prints the address it's using, which is normally `http://localhost:5173`.
