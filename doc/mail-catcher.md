# Catch-all mailbox (DEV only)

Every email sent by the dev stack (Keycloak, Django) goes to
[Mailpit](https://mailpit.axllent.org/), which keeps it and never relays it.
Nothing of this exists in production.

```
Keycloak dev ─┐
              ├─ SMTP hornet-finder-dev-mailpit:1025 (internal network, no TLS, no auth)
Django ───────┘
browser / script ─▶ nginx /mail/ ─auth_request─▶ oauth2-proxy ─▶ Keycloak dev
```

- **UI**: <https://dev.velutina.ovh/mail/>, Keycloak login. Access requires
  the realm role `mail-reader`, which the `admins` group grants.
- **REST API**: `https://dev.velutina.ovh/mail/api/v1/...` (see the
  [Mailpit API docs](https://mailpit.axllent.org/docs/api-v1/)), with an
  `Authorization: Bearer <Keycloak access token>` header. The token must carry
  the audience `mail-proxy-dev` and the role `mail-reader`. The service account
  of the `mail-proxy-dev` client has both (grant `client_credentials`, secret
  `MAIL_PROXY_CLIENT_SECRET` in `.env`). Without a token, the API answers 401;
  browsers are redirected to the login page.
- **Admin page**: in dev, the "Internal mail server" tile under Administration
  links to the UI. The PWA service worker leaves `/mail/` alone (no SPA
  fallback, no page cache).
- **Label**: the UI shows "Velutina DEV" (`MP_LABEL`).
- **Storage**: ephemeral, capped at 500 messages. Recreating the container
  empties the mailbox.

## Command line

```bash
./mail-api.sh list                              # latest messages
./mail-api.sh search 'to:t-owner@example.invalid subject:"Vérifier"'
./mail-api.sh links latest                      # URLs of the latest message
./mail-api.sh get <id>                          # full message (JSON)
./mail-api.sh clear                             # empty the mailbox
curl -H "Authorization: Bearer $(./mail-api.sh token)" https://dev.velutina.ovh/mail/api/v1/messages
```

## Configuration

- Services `hornet-finder-dev-mailpit` and `hornet-finder-dev-mail-proxy` in
  `docker-compose.dev.yml`, `location /mail/` in `nginx/conf.d/app-dev.conf`.
- Keycloak: the realm SMTP server, the `mail-reader` role and the
  `mail-proxy-dev` client (with an audience mapper and a service account) are
  in `auth/realm-export-dev.json`. That file is only imported when the realm is
  created; on a running realm, change them through the Admin API or the
  console.
- The realm signs tokens with PS256, hence
  `OAUTH2_PROXY_OIDC_ENABLED_SIGNING_ALGS` (OIDC discovery is skipped so that
  token redemption and JWKS go through the internal Keycloak URL).
