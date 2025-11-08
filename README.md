# actual-auto-auth

Forward-auth gateway for the Actual automation stack. Presents a simple password form, issues signed session cookies, and plays nicely with Traefik so each service can drop bespoke UI auth code.

## Features

- HMAC-signed session cookie derived from your shared `ACTUAL_PASSWORD`, no external state required.
- `/check` endpoint for Traefik `forwardAuth`, plus `/auth/login` and `/auth/logout` helpers.
- Customisable login heading via `AUTH_APP_NAME` so users know which service they’re accessing.
- Health check script and Docker image ready for reuse across the fleet.

## Requirements

- Node.js ≥ 22.
- `ACTUAL_PASSWORD` environment variable (shared secret used across your services).

## Installation

```bash
git clone https://github.com/rjlee/actual-auto-auth.git
cd actual-auto-auth
npm install
```

Optional git hooks:

```bash
npm run prepare
```

### Docker quick start

```bash
cp .env.example .env
docker compose up --build
# Traefik example
docker run --rm \
  -e ACTUAL_PASSWORD=supersecret \
  -e AUTH_APP_NAME="Actual Auto Categorise" \
  -p 4000:4000 \
  ghcr.io/rjlee/actual-auto-auth:latest
```

Published images live at `ghcr.io/rjlee/actual-auto-auth:<tag>` (see [Image tags](#image-tags)).

## Configuration

- `.env` – primary configuration, copy from `.env.example`.

| Setting            | Description                               | Default               |
| ------------------ | ----------------------------------------- | --------------------- |
| `ACTUAL_PASSWORD`  | Shared password required to authenticate  | _required_            |
| `SESSION_SECRET`   | Optional override for signing cookie HMAC | derived from password |
| `AUTH_COOKIE_NAME` | Cookie name used to persist the session   | `actual-auth`         |
| `AUTH_APP_NAME`    | Default text shown on the login screen    | `Actual Service`      |
| `PORT`             | Listen port                               | `4000`                |

## Usage

### CLI

```bash
ACTUAL_PASSWORD=supersecret node src/index.js
```

### Docker + Traefik (example)

```yaml
services:
  traefik:
    image: traefik:2.11
    command:
      - --entrypoints.web.address=:80
      - --providers.docker=true
      - --providers.docker.exposedbydefault=false
    ports:
      - 80:80
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro

  actual-auto-auth:
    image: ghcr.io/rjlee/actual-auto-auth:latest
    environment:
      ACTUAL_PASSWORD: ${ACTUAL_PASSWORD}
      AUTH_APP_NAME: "Actual Auto Categorise"
    networks:
      - internal
    labels:
      - traefik.enable=true
      - traefik.http.routers.auth.rule=PathPrefix(`/auth`)
      - traefik.http.routers.auth.entrypoints=web
      - traefik.http.services.auth.loadbalancer.server.port=4000
      - traefik.http.middlewares.actual-forward.forwardauth.address=http://actual-auto-auth:4000/check
      - traefik.http.middlewares.actual-forward.forwardauth.trustForwardHeader=true
      - traefik.http.middlewares.actual-forward.forwardauth.authResponseHeaders=Set-Cookie
```

Then attach your upstream service router to `middlewares=actual-forward@docker`.

> Tip: you can reuse a single auth container for multiple services by chaining a Traefik headers middleware that sets `X-Actual-App-Name` (and optionally `X-Actual-Cookie-Name`) per router:
>
> ```yaml
> traefik.http.middlewares.categorise-auth.headers.customrequestheaders.X-Actual-App-Name=Actual Auto Categorise
> traefik.http.middlewares.categorise-auth.headers.customrequestheaders.X-Actual-Cookie-Name=categorise-auth
> traefik.http.middlewares.categorise-chain.chain.middlewares=categorise-auth,actual-forward
> traefik.http.routers.categorise.middlewares=categorise-chain@docker
> ```
>
> Update the downstream service so `AUTH_COOKIE_NAME` matches the value you send via `X-Actual-Cookie-Name`. `X-Actual-App-Name` overrides the login heading dynamically, while `AUTH_APP_NAME` remains the fallback.

## Testing & linting

```bash
npm test
npm run lint
npm run lint:fix
npm run format
npm run format:check
```

## Image tags

- `ghcr.io/rjlee/actual-auto-auth:<semver>` – pinned releases.
- `ghcr.io/rjlee/actual-auto-auth:latest` – highest published version.

See [rjlee/actual-auto-ci](https://github.com/rjlee/actual-auto-ci) for tagging policy and release automation.

## License

MIT © contributors.
