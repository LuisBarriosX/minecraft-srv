import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readNbt, writeNbt, encodeTag, field, plain } from './nbt.mjs';

// Run only after the fresh world has generated and the server has stopped.
const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'world');
const destination = path.join(root, 'world_fresh_20260906');
const backup = path.join(root, 'backups/world-reset-2026-09-06');
const recoverGraves = process.argv.includes('--recover-graves');
if (process.argv.slice(2).some(arg => arg !== '--recover-graves')) throw new Error('Unknown argument');
const level = field(readNbt(fs.readFileSync(path.join(destination, 'level.dat'))).fields, 'Data').value;
const spawn = ['SpawnX', 'SpawnY', 'SpawnZ'].map(name => plain(field(level, name)));
assert.ok(spawn.every(Number.isFinite), 'Missing generated spawn');
const seed = plain(field(field(level, 'WorldGenSettings').value, 'seed'));
assert.equal(seed, '-8104038497136792010', 'Unexpected destination seed');
const playerDirectory = path.join(destination, 'playerdata');
if (fs.existsSync(playerDirectory) && fs.readdirSync(playerDirectory).length) {
  throw new Error('Destination already contains player data. Refusing to replace it.');
}
const names = new Map(JSON.parse(fs.readFileSync(path.join(root, 'usercache.json'), 'utf8')).map(player => [player.uuid, player.name]));
function sha(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
function replace(fields, name, type, value) {
  const tag = { name, type, value };
  const index = fields.findIndex(entry => entry.name === name);
  if (index < 0) fields.push(tag); else fields[index] = tag;
}
function copyDirectory(name) {
  const from = path.join(source, name);
  const to = path.join(destination, name);
  if (!fs.existsSync(from)) return;
  if (fs.existsSync(to)) throw new Error(`Destination ${name} already exists`);
  fs.cpSync(from, to, { recursive: true, errorOnExist: true, force: false });
}
const removed = new Set(['SpawnX', 'SpawnY', 'SpawnZ', 'SpawnAngle', 'SpawnDimension', 'SpawnForced',
  'LastDeathLocation', 'RootVehicle', 'enteredNetherPosition', 'SleepingX', 'SleepingY', 'SleepingZ', 'active_effects']);
const changed = new Set([...removed, 'Pos', 'Motion', 'Rotation', 'Dimension', 'Health', 'DeathTime', 'HurtTime',
  'HurtByTimestamp', 'FallDistance', 'FallFlying', 'Fire', 'Air', 'OnGround', 'SleepTimer', 'PortalCooldown',
  'foodLevel', 'foodSaturationLevel', 'foodExhaustionLevel', 'foodTickTimer']);
const report = { oldWorld: 'world', newWorld: 'world_fresh_20260906', seed, spawn, recoverGraves, players: [], sharedFiles: [] };
const prepared = [];

for (const name of fs.readdirSync(path.join(source, 'playerdata')).filter(name => name.endsWith('.dat'))) {
  const uuid = name.slice(0, -4);
  const original = fs.readFileSync(path.join(source, 'playerdata', name));
  const originalNbt = readNbt(original);
  assert.deepEqual(readNbt(writeNbt(originalNbt)).buffer, originalNbt.buffer, `Round-trip failed: ${name}`);
  const nbt = { ...originalNbt, fields: originalNbt.fields.filter(tag => !removed.has(tag.name)) };
  replace(nbt.fields, 'Pos', 9, { elementType: 6, items: [spawn[0] + 0.5, spawn[1] + 1, spawn[2] + 0.5] });
  replace(nbt.fields, 'Motion', 9, { elementType: 6, items: [0, 0, 0] });
  replace(nbt.fields, 'Rotation', 9, { elementType: 5, items: [0, 0] });
  replace(nbt.fields, 'Dimension', 8, 'minecraft:overworld');
  for (const [key, type, value] of [['Health',5,20],['DeathTime',2,0],['HurtTime',2,0],['HurtByTimestamp',3,0],
    ['FallDistance',5,0],['FallFlying',1,0],['Fire',2,-20],['Air',2,300],['OnGround',1,1],['SleepTimer',2,0],
    ['PortalCooldown',3,0],['foodLevel',3,20],['foodSaturationLevel',5,5],['foodExhaustionLevel',5,0],['foodTickTimer',3,0]]) {
    replace(nbt.fields, key, type, value);
  }
  let recoveredDeath;
  const inventory = field(nbt.fields, 'Inventory');
  if (recoverGraves && inventory.value.items.length === 1 && plain(field(inventory.value.items[0], 'id')) === 'gravestone:obituary') {
    const components = field(inventory.value.items[0], 'components').value;
    const death = field(components, 'gravestone:death').value;
    const hex = field(death, 'DeathID').value.toString('hex');
    const deathId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    const grave = readNbt(fs.readFileSync(path.join(source, 'deaths', uuid, `${deathId}.dat`))).fields;
    assert.deepEqual(field(grave, 'PlayerUuid').value, field(originalNbt.fields, 'UUID').value, 'Wrong grave owner');
    assert.equal(field(grave, 'Items').value.items.length, 0, 'Unslotted grave items require manual recovery');
    const items = [];
    for (const [key, base, max] of [['MainInventory',0,35],['ArmorInventory',100,3],['OffHandInventory',150,0]]) {
      for (const item of field(grave, key).value.items) {
        const tags = [...item];
        const oldSlot = plain(field(tags, 'Slot'));
        assert.ok(oldSlot >= 0 && oldSlot <= max, 'Invalid grave inventory slot');
        let slot = oldSlot + base;
        if (slot > 127) slot -= 256;
        replace(tags, 'Slot', 1, slot);
        // Every component, including captured maids and nested inventories, remains byte-identical.
        for (const tag of item.filter(tag => tag.name !== 'Slot')) assert.deepEqual(encodeTag(field(tags, tag.name)), tag.raw);
        items.push(tags);
      }
    }
    assert.equal(new Set(items.map(item => plain(field(item, 'Slot')))).size, items.length, 'Duplicate grave slots');
    replace(nbt.fields, 'Inventory', 9, { elementType: 10, items });
    recoveredDeath = deathId;
  }
  const bytes = writeNbt(nbt);
  const verified = readNbt(bytes);
  const protectedTags = originalNbt.fields.filter(tag => !changed.has(tag.name) && !(recoveredDeath && tag.name === 'Inventory'));
  for (const tag of protectedTags) assert.deepEqual(field(verified.fields, tag.name)?.raw, tag.raw, `Changed preserved tag: ${uuid}/${tag.name}`);
  assert.deepEqual(field(verified.fields, 'Inventory').raw, encodeTag(field(nbt.fields, 'Inventory')));
  report.players.push({ name: names.get(uuid) ?? uuid, uuid, originalSha256: sha(original), migratedSha256: sha(bytes),
    inventoryStacks: field(verified.fields, 'Inventory').value.items.length,
    enderChestStacks: field(verified.fields, 'EnderItems')?.value.items.length ?? 0,
    xpLevel: plain(field(verified.fields, 'XpLevel')), protectedTagsVerified: protectedTags.length,
    inventorySha256: sha(field(verified.fields, 'Inventory').raw), ...(recoveredDeath ? { recoveredDeath } : {}) });
  prepared.push({ name, bytes });
}

fs.mkdirSync(playerDirectory, { recursive: true });
for (const player of prepared) {
  fs.writeFileSync(path.join(playerDirectory, player.name), player.bytes, { flag: 'wx' });
  fs.writeFileSync(path.join(playerDirectory, `${player.name}_old`), player.bytes, { flag: 'wx' });
}
for (const directory of ['advancements', 'stats', 'deaths']) copyDirectory(directory);
fs.mkdirSync(path.join(destination, 'data'), { recursive: true });
const sharedNames = fs.readdirSync(path.join(source, 'data')).filter(name =>
  ['sophisticatedbackpacks.dat', 'beltborne_lanterns_belts.dat', 'idcounts.dat'].includes(name) || /^map_\d+\.dat$/.test(name));
for (const name of sharedNames) {
  const from = path.join(source, 'data', name);
  const to = path.join(destination, 'data', name);
  // A first boot may have created empty storage. Keep a backup before replacing it.
  if (fs.existsSync(to)) fs.copyFileSync(to, path.join(backup, `new-world-initial-${name}`), fs.constants.COPYFILE_EXCL);
  fs.copyFileSync(from, to);
  assert.deepEqual(fs.readFileSync(to), fs.readFileSync(from));
  report.sharedFiles.push({ name, sha256: sha(fs.readFileSync(to)) });
}
fs.writeFileSync(path.join(backup, 'migration-report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
console.log(JSON.stringify(report, null, 2));
