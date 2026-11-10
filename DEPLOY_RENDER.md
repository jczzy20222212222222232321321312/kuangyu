# Deploy ORE.ZONE

## 1. API on Render

Create a Render Blueprint from this repository. `render.yaml` defines:

- `ore-zone-api` Docker web service
- `ore-zone-db` PostgreSQL database

After the blueprint is created, set these dashboard secrets:

- `CLAIM_SIGNER_KEY` — the BSC Testnet signer private key
- `CORS_ORIGIN` — the GitHub Pages origin, e.g. `https://jczzy20222212222222232321321312.github.io`

The API URL will be:

```
https://ore-zone-api.onrender.com
```

Test:

```
https://ore-zone-api.onrender.com/health
```

## 2. Static frontend on GitHub Pages

Push to `main`; the `pages` workflow deploys the repository root.

Enable Pages in repository Settings → Pages → Source: GitHub Actions.

Open:

```
https://jczzy20222212222222232321321312.github.io/ore-zone/index.html?server=https://ore-zone-api.onrender.com
```

The `server` query parameter points the frontend at the Render API.

## 3. Important

- GitHub Pages is static only; the API is Render.
- Render free services sleep after inactivity; first request may be slow.
- Never commit `CLAIM_SIGNER_KEY`; use Render secret env vars.
