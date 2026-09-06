# Fresh world — September 6, 2026

The server now selects `world_fresh_20260906`. It uses the existing mods and normal Minecraft terrain with seed `-8104038497136792010`.

On a Linux host, start it with `sh run.sh nogui` using the host's Java 21 installation. On Windows, use `run.bat`; that launcher uses the local portable Java 21 runtime in `.runtime` when available, or Java from PATH otherwise. Memory is set to a maximum of 4 GB. The normal port remains **25565**. The local validation server was stopped after generation; the remote host has not been controlled from this workspace.

Spawn is at **0, 96, -16**, in a snowy grove. Migrated players start one block above the spawn position, with health and food restored and old bed/death locations cleared. The server located a cherry grove at **-928, 96, 912** and a plains village at **-1280, ~, -1792**.

## What carried over

- All four saved player UUIDs, including both historical profiles named M4ST3RPR0.
- Current inventories, armor, offhand, ender chests, item components, and NeoForge/Curios player data.
- XP, learned recipes, advancements, and statistics.
- Backpack storage, lantern belt storage, and both saved grave records.

Terrain, placed containers, builds, and world entities start fresh. Their originals remain in the old `world` folder. Maids stored inside carried items retain their item data; maids left standing in the old world have not been moved.

## Items in graves

Mario and Donvergas had only grave notices in their saved inventories. Those notices were preserved exactly; their grave items have **not** been automatically restored. Their death records were copied into the new world so an operator can recover the items while each player is online:

```text
/restore Mario f70702a3-0c3d-4334-960c-d0f6e58325fe add
/restore Donvergas 715868c1-13e6-43bb-b68f-ca74d15ba154 add
```

Use each recovery once. The `add` mode retains the player's current items. In the server console, omit the leading `/`. See the [GraveStone author's recovery instructions](https://github.com/henkelmax/gravestone#recovering-lost-items-1163).

## Backups and rollback

The original `world` directory was not modified. Additional backups of player data, mod storage, death records, configuration, and startup files are in `backups/world-reset-2026-09-06`.

To return to the old world, stop the server cleanly, then change these entries in `server.properties`:

```properties
level-name=world
level-seed=
```

Restart the server. This also returns players to their old saved state; subsequent progress made in the fresh world stays in `world_fresh_20260906`.

## Repository deployment

The generated `world_fresh_20260906` directory, migrated inventories, and updated `server.properties` are committed together, so the host can receive the complete reset through Git. Binary save data is preserved exactly across platforms. Local Java downloads, extra backups, and the temporary world session lock are excluded.

The push target is the `main` branch of the `LuisBarriosX/minecraft-srv` fork. It includes the existing hard-difficulty and three-mod additions already present in local commit `b421d24`. The upstream repository is not the push target.

For the first deployment, stop the hosted server cleanly before updating its checkout, then start it with Java 21. Inventories in this commit are from the server snapshot supplied for the reset. If players continued playing on the host after that snapshot, preserve and migrate those newer saves before switching worlds. The old `world` directory remains available on the host, and its tracked files are unchanged by this reset.

Once players use the fresh world, keep its live saves on persistent storage. Do not replace them with this initial snapshot on subsequent deployments. The migration scripts are one-time preparation tools and should not run automatically at server startup.

## Verification

The complete modded server generated the new world, reached `Done`, saved all dimensions, and exited cleanly. The spawn chunk was inspected: snow-covered ground with clear headroom. Existing mod integration warnings remain in the startup log.

All player files were parsed and round-tripped before migration. Every preserved NBT tag, including inventories, item components, ender chests, and mod attachments, was compared byte-for-byte after writing. Shared inventory storage files were also compared byte-for-byte. No player client login was performed.

The detailed inventory hashes and counts are in `backups/world-reset-2026-09-06/migration-report.json`; startup evidence is in `backups/world-reset-2026-09-06/generation.log`.

The scripts under `tools` document this one-time migration. They are not part of normal server startup and refuse to overwrite populated migration destinations.
