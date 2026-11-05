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

## Deploy to the app VM

The VM (`192.168.1.12`, Debian with Docker) runs three containers from `deploy/docker-compose.yml`: PocketBase, the service, and Caddy, which serves the built web app and proxies `/api`, `/_`, and `/service` on one address. Caddy listens only on the VM's `127.0.0.1:8080`. `tailscale serve` adds HTTPS and keeps it Tailscale-only.

1. Copy the repository to the VM, without `service/.env` and `pocketbase/pb_data`. For example, `git clone` on the VM once the code is pushed.
2. On the VM, create `service/.env` from `service/.env.example` and set `HOME_ASSISTANT_TOKEN`. The compose file overrides the PocketBase address and host for you.
3. Start everything from the repository root:

```bash
docker compose -f deploy/docker-compose.yml up -d --build
```

4. Put HTTPS in front of it, once:

```bash
sudo tailscale serve --bg 8080
```

5. Create your login at `https://<vm-name>.<tailnet>.ts.net/_/`. Make the PocketBase admin account first, then add a user under **Collections > users**. The VM has its own database in `deploy/data/pb_data`, so the local one doesn't carry over.
6. On the phone, with Tailscale on, open that address and use **Add to Home screen**.

To update, pull the new code and run the same `docker compose` command again.
