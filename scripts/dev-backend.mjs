import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function isJdk25(dir) {
  if (!dir) return false;
  const javaBin = path.join(dir, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  if (!fs.existsSync(javaBin)) return false;
  const result = spawnSync(javaBin, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  return /version "25\b/.test(output);
}

function findJdk25() {
  const userHome = process.env.USERPROFILE || process.env.HOME || '';
  const candidates = [
    process.env.JAVA_HOME,
    path.join(userHome, '.jdks', 'openjdk-25.0.1'),
    path.join(userHome, '.jdk', 'jdk-25', 'jdk-25.0.4.1+1'),
  ];
  const jdksDir = path.join(userHome, '.jdks');
  if (fs.existsSync(jdksDir)) {
    for (const entry of fs.readdirSync(jdksDir)) {
      if (entry.includes('25')) candidates.push(path.join(jdksDir, entry));
    }
  }
  for (const dir of candidates) {
    if (isJdk25(dir)) return dir;
  }
  return process.env.JAVA_HOME || '';
}

function findMavenBinDir() {
  const jetbrainsDir = 'C:\\Program Files\\JetBrains';
  if (fs.existsSync(jetbrainsDir)) {
    for (const entry of fs.readdirSync(jetbrainsDir)) {
      const binDir = path.join(jetbrainsDir, entry, 'plugins', 'maven', 'lib', 'maven3', 'bin');
      if (fs.existsSync(path.join(binDir, 'mvn.cmd'))) return binDir;
    }
  }
  const userHome = process.env.USERPROFILE || '';
  const localMaven = path.join(userHome, '.maven', 'apache-maven-3.9.15', 'bin');
  if (fs.existsSync(path.join(localMaven, 'mvn.cmd'))) return localMaven;
  return '';
}

const javaHome = findJdk25();
const mavenBinDir = findMavenBinDir();
const extraPaths = [
  javaHome ? path.join(javaHome, 'bin') : '',
  mavenBinDir,
].filter(Boolean);

const env = { ...process.env };
const existingPath = env.Path || env.PATH || '';
delete env.Path;
delete env.PATH;
env.PATH = [...extraPaths, existingPath].filter(Boolean).join(path.delimiter);
if (javaHome) env.JAVA_HOME = javaHome;

const mvnExecutable = process.platform === 'win32' ? 'mvn.cmd' : 'mvn';

console.log(`Using JAVA_HOME: ${javaHome || '(system default)'}`);
console.log(`Using Maven dir: ${mavenBinDir || '(system PATH)'}`);
if (process.argv.includes('--check')) {
  process.exit(0);
}
console.log('Auto-reload enabled (Spring Boot DevTools). Watching src/main for changes...\n');

function runMvn(args) {
  return spawn(mvnExecutable, args, {
    cwd: projectRoot,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

const server = runMvn(['spring-boot:run']);

let debounceTimer = null;
let compiling = false;
let pendingRecompile = false;

function triggerCompile() {
  if (compiling) {
    pendingRecompile = true;
    return;
  }
  compiling = true;
  console.log('\n[auto-reload] Change detected in src/main — recompiling...');
  const compiler = runMvn(['-q', 'compile']);
  compiler.on('close', (code) => {
    compiling = false;
    if (code === 0) {
      console.log('[auto-reload] Compiled cleanly — Spring Boot DevTools will restart automatically.\n');
    } else {
      console.log('[auto-reload] Compile failed — save a fix to retry.\n');
    }
    if (pendingRecompile) {
      pendingRecompile = false;
      triggerCompile();
    }
  });
}

const watchRoot = path.join(projectRoot, 'src', 'main');
const watcher = fs.watch(watchRoot, { recursive: true }, (_eventType, filename) => {
  if (!filename) return;
  const normalized = filename.replace(/\\/g, '/');
  if (normalized.startsWith('resources/static/')) return;
  if (!/\.(java|properties|xml|sql|yml|yaml)$/i.test(normalized)) return;

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(triggerCompile, 450);
});

function shutdown() {
  watcher.close();
  if (!server.killed) server.kill();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
server.on('close', (code) => {
  watcher.close();
  process.exit(code ?? 0);
});
