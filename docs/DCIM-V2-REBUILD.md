# Metrotech DCIM V2 — Rebuild foundation

This work is isolated on branch `feature/dcim-v2-rebuild`. **Do not deploy as finished V2** until Fiber Planner integration and end-to-end acceptance are complete.

## Database boundaries

- `data/auth.sqlite`: users, roles, sessions; no assets
- `data/dcim.sqlite`: datacenters, layout entities, racks, assets, inventory, connectivity
- `data/db.sqlite`: untouched historical V1 file; do not delete without verified offline backup
- upstream `fiber-planner`: separate source-only project (no EDGE operational data in Git). Its layout/fiber routing backend is still single-floor `floor7` and requires an initialized layout; integrating it must not silently invent data or expose its unauthenticated API.

The new SQLite files are intentionally empty when installed from scratch. Data migrations, reset, routing integration, and physical service deployment are distinct operations.

## Admin bootstrap in a new V2 environment

Run only on a disposable V2 installation after the new app image has been built, and only if the auth store has no users. Never place the initial password in Git, Docker Compose, shell history or command arguments.

Example from a trusted interactive terminal:

```bash
read -rsp "One-time Administrator password: " MTR_BOOTSTRAP
printf '\n'
printf '%s\n' "$MTR_BOOTSTRAP" |
  sudo docker compose -f compose.yml exec -T metrotech-dcim node scripts/bootstrap-admin.mjs
unset MTR_BOOTSTRAP
```

First sign-in must change the bootstrap password. Administrator can then create editor users and assign name, username, email and temporary password. Public signup is disabled.

## Verification gates

1. Create fresh auth and DCIM files, verify data isolation with SQLite table lists.
2. Confirm admin first-login password change, admin-only user management, and editor sign-in.
3. Verify no existing accounts or datacenters appear in new V2 databases.
4. Complete Fiber Planner adaptation in a separate service with authentication and per-DC isolation; preserve upstream planner visuals/algorithms.
5. Complete rack click → editable capacity → **existing Interportal asset model**, validate U-position collisions and persistence.
6. Run migrations, tests, build, then perform browser E2E.
7. Only after acceptance: backup/export current V1 live data, cutover traffic and rotate sessions. Do not run `docker compose down -v` or delete legacy data.

## Branding and style

Retain Metrotech dark-nav UI and actual logo/favicon. Use shared radius tokens for card/input/modal consistency, without replacing the original application layout.
