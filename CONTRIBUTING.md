# Contributing

## Prerequisites

Use Node.js 20.19 or newer (the CI workflow tracks the maintained Node 20 line) and npm. This minimum satisfies Vite 8's runtime requirement.

## Working agreements

1. Contracts first: changes to `packages/contracts` must be reflected in the API docs and `docs/CHANGELOG.md`.
2. Keep one module responsible for one domain. Cross-module changes should be small and documented.
3. Use conventional commit messages, for example `feat(algo): add held-karp solver`.
4. A change is complete when it has tests, a useful code comment, and docs where behavior changed.
5. Keep `packages/algorithms` pure: no HTTP, database, cache, or unseeded randomness.
6. Use deterministic seeds for generated examples and benchmarks.
7. Put small known-answer datasets in `packages/algorithms/fixtures/`.

## Local workflow

```bash
cp .env.example .env
npm install
npm run dev
npm test
npm run build
```

The API listens on port 4000 and the Vite app on 5173. Docker Compose is available for the full Postgres + Redis + API + web topology.
