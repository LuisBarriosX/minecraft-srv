import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const serverRoot = path.resolve(import.meta.dirname, '..');
const java = path.join(serverRoot, '.runtime/jdk-21.0.12.1+1-jre/bin/java.exe');
const logPath = path.join(serverRoot, 'backups/world-reset-2026-09-06/generation.log');
const properties = fs.readFileSync(path.join(serverRoot, 'server.properties'), 'utf8');
if (!/^server-ip=127\.0\.0\.1\r?$/m.test(properties) ||
    !/^level-name=world_fresh_20260906\r?$/m.test(properties)) {
  throw new Error('Generation requires the new world and localhost binding.');
}
if (fs.existsSync(path.join(serverRoot, 'world_fresh_20260906/level.dat'))) {
  throw new Error('The destination world already exists; refusing to generate it again.');
}
// Open synchronously so a failed exclusive log creation cannot leave Java running.
const log = fs.createWriteStream(logPath, { fd: fs.openSync(logPath, 'ax') });
const child = spawn(java, ['-Xms512M', '-Xmx4G', '@libraries/net/neoforged/neoforge/21.1.238/win_args.txt', '--nogui', '--port', '25566'], {
  cwd: serverRoot, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
});
let ready = false;
let buffer = '';
const timer = setTimeout(() => {
  console.error('Startup timed out; requesting a clean shutdown.');
  child.stdin.write('stop\n');
  process.exitCode = 1;
}, 300_000);
function output(chunk) {
  log.write(chunk);
  buffer += chunk.toString();
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop();
  for (const line of lines) {
    if (/ERROR|FATAL|Exception|Starting minecraft|Preparing|Done \(|Seed:|Saving|All dimensions|Stopped|nearest|Could not find/i.test(line)) console.log(line);
    if (!ready && /Done \(/.test(line)) {
      ready = true;
      clearTimeout(timer);
      child.stdin.write('seed\nlocate structure minecraft:village_plains\nlocate biome minecraft:cherry_grove\nsave-all flush\nstop\n');
    }
  }
}
child.stdout.on('data', output);
child.stderr.on('data', output);
child.on('error', error => { console.error(error); clearTimeout(timer); log.end(); process.exitCode = 1; });
child.on('exit', code => {
  clearTimeout(timer);
  log.end();
  if (code !== 0 || !ready) process.exitCode = 1;
  console.log(`Generation finished: exit=${code}, reachedReady=${ready}`);
});
