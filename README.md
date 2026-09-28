# Metrotech Interportal — DCIM Rack Builder

Metrotech Interportal is a lightweight Data Center Infrastructure Management (DCIM) application for mapping datacenters, rooms, racks, devices, ports, and cable connections.

## Tech Stack

- **Runtime:** Node.js 24 LTS
- **Package Manager:** pnpm 12
- **Framework:** React 19 + TanStack Start
- **Routing / SSR:** TanStack Router + TanStack Start
- **Build Tool:** Vite 7
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Drag & Drop:** dnd-kit
- **Icons:** Lucide React
- **Database:** SQLite via better-sqlite3
- **Persistence:** single local SQLite database with automatic legacy JSON migration
- **Lint / Format:** Biome
- **Tests:** Vitest + Testing Library

> The current data layer is SQLite-only. Existing `data/db.json` content is imported automatically once into SQLite on startup so older local environments can move forward without manual conversion.

## Local Development

### Requirements

- Node.js **24.x** (recommended: **24.21.0**)
- pnpm **12.7.x**

The repository contains an `.nvmrc` and explicit runtime constraints in `package.json`.

### Install

```bash
npm install -g pnpm@12.7.0
pnpm install
```

Native build permissions for `better-sqlite3`, `esbuild`, and `lightningcss` are already declared in `pnpm-workspace.yaml`, so a clean install should not require `pnpm approve-builds`.

### Verify Environment

```bash
pnpm run doctor
```

Expected result:

```text
Node runtime: OK
better-sqlite3 native binding: OK
```

### Start Development Server

```bash
pnpm dev
```

Open:

```text
http://localhost:3000
```

Vite is configured to listen on the local network as well, so another device on the same LAN can use the laptop's local IP and port 3000.

## Local Data

On first use the application creates local data under:

```text
data/
├── db.sqlite
└── db.json  # legacy source; imported once if present
```

These files are intentionally ignored by Git.

- `db.sqlite`: users, sessions, datacenters, rooms, racks, devices, inventory blueprints, and connections
- `db.json`: legacy compatibility only; no longer used after migration

## Application Flow

```text
Account
  ↓
Datacenter
  ↓
Room
  ↓
Rack
  ↓
Device / Port / Connection
```

Users can create an account locally, add datacenters, create rooms and racks, place devices into rack units, maintain reusable inventory blueprints, and map physical connectivity between ports.

## Useful Commands

```bash
pnpm dev
pnpm run doctor
pnpm check
pnpm test
pnpm build
```

## Development Notes

- Do not commit local SQLite / JSON data.
- Avoid using `latest` for core framework dependencies; framework versions are pinned intentionally for reproducible installs.
- Use the Node version declared by the repository before reinstalling `node_modules`, especially because `better-sqlite3` contains a native Node binding.
