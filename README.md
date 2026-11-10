# swapic-app

The Swapic web app: a Next.js static export served from two asset canisters on the Internet
Computer.

| Canister | ID | Site |
|---|---|---|
| `swapic_prod` | `dduc6-3yaaa-aaaal-ai63a-cai` | https://swapic.xyz |
| `swapic_test` | `ib67n-yiaaa-aaaao-qjwca-cai` | https://test.swapic.xyz |

Both are in `canister_ids.json`. The app calls the API at `api.swapic.xyz`.

## Run it locally

Use pnpm (Node from `.nvmrc`):

```sh
pnpm install
pnpm dev          # http://localhost:3000, against the test environment
```

## Checks

```sh
pnpm typecheck
pnpm test         # vitest, then playwright
pnpm check:copy
pnpm check:sources
```

## Build

```sh
pnpm build:prod   # the static export for swapic.xyz, then the asset checks
pnpm build:test   # the same for test.swapic.xyz
```

## Release

Every change reaches `main` through a pull request with a green `app` check. A push to
`main` builds the release, and the server downloads it. Nothing goes live until someone
presses **deploy app** in GitHub Actions. The server then commits the build to
`swapic_prod`; its identity may only prepare and commit assets there, never control the
canister.
