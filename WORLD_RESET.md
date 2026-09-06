# Fresh world — September 6, 2026

The server now selects `world_fresh_20260906`. It uses the existing mods and normal Minecraft terrain with seed `-8104038497136792010`.

Player data was refreshed from upstream commit [`952c1ec`](https://github.com/M4rio1/minecraft-srv/commit/952c1ecbef2e5c8a2e74ae3ed647128abd4aa0b4). That world was last saved on **September 6, 2026 at 23:00:32 UTC / 5:00:32 PM Guatemala time**. This replaces the older inventory snapshot in the initial reset commit.

On a Linux host, start it with `sh run.sh nogui` using the host's Java 21 installation. On Windows, use `run.bat`; that launcher uses the local portable Java 21 runtime in `.runtime` when available, or Java from PATH otherwise. Memory is set to a maximum of 4 GB. The normal port remains **25565**. The local validation server was stopped after generation; the remote host has not been controlled from this workspace.

Spawn is at **0, 96, -16**, in a snowy grove. Migrated players start one block above the spawn position, with health and food restored and old bed/death locations cleared. The server located a cherry grove at **-928, 96, 912** and a plains village at **-1280, ~, -1792**.

## What carried over

- All four saved player UUIDs, including both historical profiles named M4ST3RPR0.
- Current inventories, armor, offhand, ender chests, item components, and NeoForge/Curios player data.
- XP, learned recipes, advancements, and statistics.
- Both diamond backpacks and their separate stored contents, current lantern belt storage, and all 17 saved grave records.

M4ST3RPR0's current profile has **34 inventory stacks and XP level 9**; Donvergas has **29 inventory stacks and XP level 7**. Their item components, armor, offhand, and backpack storage were checked against the new upstream save.

Terrain, placed containers, builds, and world entities start fresh. Their originals remain in the old `world` folder. Maids stored inside carried items retain their item data; maids left standing in the old world have not been moved.

## Items in graves

Mario still has only a grave notice in his saved inventory. It was preserved exactly; grave items have **not** been automatically restored. His matching death record was copied into the new world so an operator can recover the items while Mario is online:

```text
/restore Mario f70702a3-0c3d-4334-960c-d0f6e58325fe add
```

Use each recovery once. The `add` mode retains the player's current items. In the server console, omit the leading `/`. See the [GraveStone author's recovery instructions](https://github.com/henkelmax/gravestone#recovering-lost-items-1163).

Donvergas now has a populated current inventory. The old recommendation to recover his September 4 grave no longer applies; his historical grave records are retained for reference.

## Backups and rollback

The `world` directory contains the complete latest upstream save from `952c1ec`, unchanged by the reset. It provides a rollback to the newer original terrain and player state. The previously prepared fresh world is backed up in `backups/inventory-refresh-952c1ec/previous-world`. Earlier preparation backups remain in `backups/world-reset-2026-09-06`.

To return to the old world, stop the server cleanly, then change these entries in `server.properties`:

```properties
level-name=world
level-seed=
```

Restart the server. This also returns players to their old saved state; subsequent progress made in the fresh world stays in `world_fresh_20260906`.

## Repository deployment

The generated `world_fresh_20260906` directory, migrated inventories, and updated `server.properties` are committed together, so the host can receive the complete reset through Git. Binary save data is preserved exactly across platforms. Local Java downloads, extra backups, and the temporary world session lock are excluded.

The push target is the `main` branch of the `LuisBarriosX/minecraft-srv` fork. It includes upstream save commit `952c1ec` and the existing hard-difficulty and three-mod additions. The upstream repository is not the push target.

For the first deployment, stop the hosted server cleanly before updating its checkout, then start it with Java 21. Inventories in this commit are from upstream's September 6, 23:00:32 UTC snapshot. If players continued playing on the host after that snapshot, preserve and migrate those newer saves before switching worlds. The old `world` directory remains available on the host; the reset retains its latest upstream contents.

Once players use the fresh world, keep its live saves on persistent storage. Do not replace them with this initial snapshot on subsequent deployments. The migration scripts are one-time preparation tools and should not run automatically at server startup.

## Verification

The complete modded server generated the new world, reached `Done`, saved all dimensions, and exited cleanly. The spawn chunk was inspected: snow-covered ground with clear headroom. Existing mod integration warnings remain in the startup log.

All player files were parsed and round-tripped before migration. Every preserved NBT tag, including inventories, item components, ender chests, and mod attachments, was compared byte-for-byte after writing. The source player files, level metadata, and shared storage were also compared directly with commit `952c1ec`. Both carried backpack UUIDs resolve to their copied content records. No player client login was performed.

The current inventory hashes, source commit, save timestamp, and counts are in `backups/inventory-refresh-952c1ec/migration-report.json`; startup evidence for the unchanged new terrain is in `backups/world-reset-2026-09-06/generation.log`. Local validation logs and caches from before the upstream merge are preserved in the Git stash named `Local validation artifacts before upstream save 952c1ec`.

The scripts under `tools` document this one-time migration. They are not part of normal server startup and refuse to overwrite populated migration destinations.
