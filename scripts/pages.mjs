import { cp, mkdir, access, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Pages requires a standard Wrangler filename in its project root and rejects
// --config. Stage an isolated project rather than overwriting the Workers config.
const root = fileURLToPath(new URL('../', import.meta.url));
const project = path.join(root, '.wrangler', 'pages-project');
const [command, ...args] = process.argv.slice(2);
if (!['dev', 'deploy', 'check'].includes(command)) {
  console.error('Usage: node scripts/pages.mjs <dev|deploy|check> [Wrangler arguments]');
  process.exit(1);
}
await mkdir(project, { recursive: true });
await rm(path.join(project, 'functions'), { recursive: true, force: true });
await cp(path.join(root, 'functions'), path.join(project, 'functions'), { recursive: true, force: true });
await rm(path.join(project, 'server'), { recursive: true, force: true });
await cp(path.join(root, 'server'), path.join(project, 'server'), { recursive: true, force: true });
await cp(path.join(root, 'wrangler.pages.toml'), path.join(project, 'wrangler.toml'));
if (command !== 'check') {
  // A fresh directory avoids publishing stale assets after a rebuild.
  await rm(path.join(project, 'dist'), { recursive: true, force: true });
  await cp(path.join(root, 'dist'), path.join(project, 'dist'), { recursive: true });
}
const localVars = path.join(project, '.dev.vars');
await rm(localVars, { force: true });
if (command === 'dev') {
  try {
    await access(path.join(root, '.dev.vars'));
    await cp(path.join(root, '.dev.vars'), localVars);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const wranglerArgs = command === 'check'
  ? ['pages', 'functions', 'build', 'functions', '--outdir', path.join(root, '.wrangler', 'pages-check')]
  : ['pages', command, 'dist', ...args];
const child = spawn(process.execPath, [path.join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js'), ...wranglerArgs], { cwd: project, stdio: 'inherit' });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { process.exitCode = code ?? 1; });
