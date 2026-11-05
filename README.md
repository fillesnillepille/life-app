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

### Use the real database in development

Instead of a local PocketBase, dev can use the one on the VM, which needs the VM running and Tailscale on. Dev then changes real data. Skip starting PocketBase, and set these two values, both of which stay out of Git:

- In `web/.env.local`: `VITE_POCKETBASE_URL=https://app.tail135add.ts.net`
- In `service/.env`: `POCKETBASE_URL=https://app.tail135add.ts.net`

Log in with the VM's user account. To go back to a local database, delete `web/.env.local` and set `POCKETBASE_URL=http://127.0.0.1:8090` again. Use a separate Home Assistant token for dev, so you can revoke it on its own.

In the Claude desktop app, `.claude/launch.json` can start PocketBase, the service, and the web app from the preview panel.

## Connect Gmail

Mail is read by the service over IMAP and mirrored into PocketBase, which the Mejl page and the Post panel on Idag show. It is read-only for now. It only starts when all four mail values in `service/.env` are set, and it should run on the VM only, so leave them empty in development.

1. In the Google account, turn on 2-Step Verification, then create an app password under **Security > 2-Step Verification > App passwords**. Copy the 16 characters, which Google shows once. Gmail also needs IMAP enabled, which it is by default.
2. In the PocketBase admin, open **Collections > users > New record** and create the service user with the email `service@life-app.local` and a long password. The `mails` collection only lets this user change mail. It can't read your lists.
3. In `service/.env` on the VM, set `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `POCKETBASE_SERVICE_PASSWORD`. The email is already filled in.
4. Restart the service so it reads the file, and check the log:

```bash
docker compose -f deploy/docker-compose.yml up -d --force-recreate service
docker compose -f deploy/docker-compose.yml logs service --tail 20
```

The first sync takes a couple of minutes, because PocketBase limits how fast records can be created, and mail appears on the Mejl page as it arrives. The page shows when it last updated. If it says the sync failed, the log has the reason. A wrong app password is not retried, to avoid getting the account locked, so fix `.env` and restart.

To stop it, empty `GMAIL_APP_PASSWORD` and restart the service. To revoke access completely, delete the app password in the Google account.

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
