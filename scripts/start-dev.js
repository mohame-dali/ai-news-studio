import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'src', 'config', 'ollamaConfig.ts');
const configSource = readFileSync(configPath, 'utf8');
const modelMatch = configSource.match(/export const DEFAULT_MODEL = runtimeEnv\.OLLAMA_MODEL \|\| "([^"]+)"/u);
const hostMatch = configSource.match(/runtimeEnv\.OLLAMA_HOST \|\| "(http:\/\/[^"]+)"/u);
if (!modelMatch || !hostMatch) {
  throw new Error('Impossible de lire DEFAULT_MODEL / OLLAMA_URL dans src/config/ollamaConfig.ts.');
}

const modelName = process.env.OLLAMA_MODEL || modelMatch[1];
const ollamaUrl = (process.env.OLLAMA_HOST || hostMatch[1]).replace(/\/+$/u, '');
const tagsUrl = `${ollamaUrl}/api/tags`;
const logDirectory = path.join(root, 'logs');
mkdirSync(logDirectory, { recursive: true });
const ollamaLog = createWriteStream(path.join(logDirectory, 'ollama.log'), { flags: 'a' });

let ollamaProcess = null;
let viteProcess = null;
let pullProcess = null;
let ownedByScript = false;
let cleanupStarted = false;
let startupError = false;

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
}

function cleanup(exitCode) {
  if (cleanupStarted) return;
  cleanupStarted = true;
  process.exitCode = exitCode;
  stopProcessTree(viteProcess);
  stopProcessTree(pullProcess);
  if (ownedByScript) stopProcessTree(ollamaProcess);
  ollamaLog.end();
}

async function getTags(timeoutMs = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(tagsUrl, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForOllama(timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !startupError && ollamaProcess?.exitCode === null) {
    const remainingMs = deadline - Date.now();
    const tags = await getTags(Math.min(2000, remainingMs));
    if (tags) return tags;
    await sleep(Math.min(1000, Math.max(0, deadline - Date.now())));
  }
  return null;
}

function startPull() {
  console.warn(`Téléchargement automatique demandé : ollama pull ${modelName}`);
  console.warn('Ce modèle peut représenter plusieurs gigaoctets ; le téléchargement dépend de votre connexion.');
  pullProcess = spawn('ollama', ['pull', modelName], { windowsHide: true });
  let output = '';
  for (const stream of [pullProcess.stdout, pullProcess.stderr]) {
    stream?.on('data', (chunk) => {
      const text = chunk.toString();
      output += text;
      process.stdout.write(text);
      ollamaLog.write(text);
    });
  }
  pullProcess.on('error', (error) => {
    console.warn('⚠️ Ollama n’est pas lancé. Veuillez l’installer ou le démarrer manuellement.');
    console.warn(`Échec de ollama pull : ${error.message}`);
  });
  pullProcess.on('exit', (code) => {
    if (code === 0) {
      console.info(`Modèle ${modelName} téléchargé.`);
    } else {
      console.warn('Échec du téléchargement du modèle (connexion hors ligne ou erreur du registre).');
      if (/not found|manifest unknown|does not exist/i.test(output)) {
        console.warn('Vérifiez `ollama list` et la source du nom de modèle avant de réessayer.');
      } else {
        console.warn('Vérifiez Ollama, votre connexion, puis `ollama list` et la source du modèle.');
      }
    }
    pullProcess = null;
  });
}

async function main() {
  let tags = await getTags(2000);
  if (tags) {
    console.info('Ollama déjà actif');
  } else {
    ollamaProcess = spawn('ollama', ['serve'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    ownedByScript = true;
    ollamaProcess.stdout?.pipe(ollamaLog, { end: false });
    ollamaProcess.stderr?.pipe(ollamaLog, { end: false });
    ollamaProcess.on('error', (error) => {
      startupError = true;
      ownedByScript = false;
      if (error.code === 'ENOENT') {
        console.warn('⚠️ Ollama n’est pas lancé. Veuillez l’installer ou le démarrer manuellement.');
      } else {
        console.warn(`⚠️ Impossible de démarrer Ollama : ${error.message}`);
      }
    });
    ollamaProcess.on('exit', () => { ownedByScript = false; });
    tags = await waitForOllama();
    if (!tags) console.warn('⚠️ Ollama ne répond pas après 30 secondes ; Vite démarre quand même.');
  }

  if (tags) {
    const modelPresent = tags.models?.some((entry) => entry.name === modelName) === true;
    if (!modelPresent) {
      console.warn(`Modèle Ollama manquant : ${modelName}`);
      console.warn(`Pour l’installer : ollama pull ${modelName}`);
      console.warn('Le téléchargement peut représenter plusieurs gigaoctets.');
      if (process.env.AUTO_PULL_MODEL === '1') startPull();
    }
  }

  const viteScript = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
  if (!existsSync(viteScript)) {
    console.error(`Binaire Vite introuvable : ${viteScript}`);
    cleanup(1);
    return;
  }
  const args = [viteScript, '--host', '127.0.0.1', '--port', '3000'];
  console.info(`Commande Vite : "${process.execPath}" ${args.map((arg) => `"${arg}"`).join(' ')}`);
  viteProcess = spawn(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  viteProcess.on('error', (error) => {
    console.error(`Impossible de démarrer Vite : ${error.message}`);
    cleanup(1);
  });
  viteProcess.on('exit', (code, signal) => {
    viteProcess = null;
    cleanup(code ?? (signal ? 1 : 0));
  });
}

process.once('SIGINT', () => cleanup(130));
process.once('SIGTERM', () => cleanup(143));
process.once('uncaughtException', (error) => {
  console.error('Erreur inattendue du lanceur :', error);
  cleanup(1);
});
process.once('unhandledRejection', (error) => {
  console.error('Erreur asynchrone inattendue du lanceur :', error);
  cleanup(1);
});

void main();
