#!/usr/bin/env node

/**
 * AI News Studio — Diagnostic d'Environnement & Vérification Prérequis (Windows / Mac / Linux)
 */

import { execSync } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';

const isWindows = process.platform === 'win32';

console.log('\n======================================================');
console.log('   AI NEWS STUDIO — DIAGNOSTIC ENVIRONNEMENT SYSTÈME  ');
console.log('======================================================\n');

console.log(`Système d'exploitation : ${os.type()} ${os.release()} (${os.arch()})`);
console.log(`Plateforme Node.js     : ${process.version} (Platform: ${process.platform})`);
console.log(`Répertoire de travail  : ${process.cwd()}\n`);

const checks = [];

// 1. Vérification Node.js Version
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (nodeMajor >= 20) {
  checks.push({ name: 'Node.js Version (>= 20)', status: 'PASS', details: `v${process.versions.node}` });
} else {
  checks.push({ name: 'Node.js Version (>= 20)', status: 'WARN', details: `v${process.versions.node} détecté, 20+ recommandé` });
}

// 2. Détection de FFmpeg
try {
  const ffmpegOutput = execSync('ffmpeg -version', { stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).toString();
  const firstLine = ffmpegOutput.split('\n')[0];
  checks.push({ name: 'FFmpeg (Moteur de rendu vidéo)', status: 'PASS', details: firstLine.slice(0, 50) });
} catch {
  checks.push({
    name: 'FFmpeg (Moteur de rendu vidéo)',
    status: isWindows ? 'WARN' : 'INFO',
    details: isWindows
      ? 'FFmpeg non trouvé dans PATH. (Sous Windows: winget install Gyan.FFmpeg ou choco install ffmpeg)'
      : 'FFmpeg non présent dans le PATH (optionnel pour la prévisualisation navigateur).'
  });
}

// 3. Détection d'Ollama Local
function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:11434/api/tags', { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const models = (parsed.models || []).map(m => m.name).join(', ');
          resolve({
            name: 'Ollama Serveur Local (Port 11434)',
            status: 'PASS',
            details: models ? `En ligne. Modèles installés: ${models}` : 'En ligne (aucun modèle listé)'
          });
        } catch {
          resolve({ name: 'Ollama Serveur Local (Port 11434)', status: 'PASS', details: 'En ligne' });
        }
      });
    });

    req.on('error', () => {
      resolve({
        name: 'Ollama Serveur Local (Port 11434)',
        status: 'INFO',
        details: 'Serveur Ollama éteint ou non joignable. Lancez "ollama serve" pour la Phase 4.'
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ name: 'Ollama Serveur Local (Port 11434)', status: 'INFO', details: 'Délai dépassé (timeout)' });
    });
  });
}

// 4. Détection Piper TTS
function checkPiper() {
  try {
    const cmd = isWindows ? 'where piper' : 'which piper';
    const pathOutput = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 }).toString().trim();
    return { name: 'Piper TTS (Synthèse vocale locale)', status: 'PASS', details: `Trouvé: ${pathOutput}` };
  } catch {
    return {
      name: 'Piper TTS (Synthèse vocale locale)',
      status: 'INFO',
      details: 'Non détecté dans le PATH (requis pour la Phase 4). Téléchargement direct ou binaire local.'
    };
  }
}

// 5. Test Port 3000
function checkPort3000() {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ name: 'Port 3000 (Serveur Studio)', status: 'WARN', details: 'Le port 3000 est déjà occupé (par le studio ou un autre service)' });
      } else {
        resolve({ name: 'Port 3000 (Serveur Studio)', status: 'PASS', details: 'Libre et disponible' });
      }
    });
    server.once('listening', () => {
      server.close();
      resolve({ name: 'Port 3000 (Serveur Studio)', status: 'PASS', details: 'Libre et disponible' });
    });
    server.listen(3000, '0.0.0.0');
  });
}

async function run() {
  checks.push(checkPiper());
  checks.push(await checkOllama());
  checks.push(await checkPort3000());

  console.log('Résultats des vérifications :\n');
  for (const c of checks) {
    const badge = c.status === 'PASS' ? '✅ [PASS]' : c.status === 'WARN' ? '⚠️  [WARN]' : 'ℹ️  [INFO]';
    console.log(`${badge} ${c.name}`);
    console.log(`   Détails: ${c.details}\n`);
  }

  console.log('------------------------------------------------------');
  console.log('Pour lancer AI News Studio :');
  console.log('   npm run dev              # ou npm run start:studio');
  if (isWindows) {
    console.log('   .\\scripts\\start-studio.ps1 # Lanceur PowerShell Windows');
  }
  console.log('======================================================\n');
}

run();
