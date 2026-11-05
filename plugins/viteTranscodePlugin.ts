/**
 * AI News Studio — Vite Plugin: Broadcast FFmpeg Video & Audio Transcoder
 * Provides `POST /api/transcode` endpoint to transcode WebM / MediaRecorder blobs
 * into high-quality H.264 / AAC MP4 with broadcast EBU R128 loudness normalization.
 */

import { Plugin } from 'vite';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface CommandResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

function runCommand(command: string, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true });
    let stdout = '';
    let stderr = '';

    child.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function getFfprobePath(): string {
  if (process.env.FFPROBE_PATH) return process.env.FFPROBE_PATH;
  if (!process.env.FFMPEG_PATH) return 'ffprobe';

  const ffmpegPath = process.env.FFMPEG_PATH;
  if (!path.dirname(ffmpegPath) || path.dirname(ffmpegPath) === '.') return 'ffprobe';
  const extension = path.extname(ffmpegPath);
  const executableName = path.basename(ffmpegPath, extension);
  const probeName = executableName.replace(/ffmpeg/i, 'ffprobe');
  return probeName === executableName ? 'ffprobe' : path.join(path.dirname(ffmpegPath), `${probeName}${extension}`);
}

async function probeMedia(filePath: string) {
  const result = await runCommand(getFfprobePath(), [
    '-v', 'error',
    '-show_entries', 'format=format_name,duration:stream=codec_type,codec_name',
    '-of', 'json',
    filePath,
  ]);
  if (result.code !== 0) {
    throw new Error(`Échec de vérification ffprobe : ${result.stderr.trim() || `code ${result.code}`}`);
  }

  const probe = JSON.parse(result.stdout) as {
    format?: { format_name?: string; duration?: string };
    streams?: Array<{ codec_type?: string; codec_name?: string }>;
  };
  const duration = Number(probe.format?.duration);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error('ffprobe n’a pas retourné une durée vidéo valide.');
  }
  return { formatName: probe.format?.format_name || '', duration, streams: probe.streams || [] };
}

export function viteTranscodePlugin(): Plugin {
  return {
    name: 'vite-plugin-ffmpeg-transcode',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);

        if (url.pathname === '/api/transcode') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez POST.' }));
            return;
          }

          const tempId = `transcode-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const inputPath = path.join(os.tmpdir(), `${tempId}.webm`);
          const outputPath = path.join(os.tmpdir(), `${tempId}.mp4`);
          const cleanup = async () => {
            await Promise.all([
              fs.promises.unlink(inputPath).catch(() => undefined),
              fs.promises.unlink(outputPath).catch(() => undefined),
            ]);
          };

          try {
            console.log(`[FFmpeg Transcode] Receiving video stream for processing...`);

            // Accumulate request chunks into buffer
            const chunks: Buffer[] = [];
            for await (const chunk of req) {
              chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
            }
            const inputBuffer = Buffer.concat(chunks);

            if (inputBuffer.length < 100) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'Flux vidéo reçu vide ou invalide.' }));
              return;
            }

            console.log(`[FFmpeg Transcode] Input size: ${(inputBuffer.length / (1024 * 1024)).toFixed(2)} MB`);
            await fs.promises.writeFile(inputPath, inputBuffer);

            // Verified command requested in specifications:
            // -c:v libx264 -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -af loudnorm=I=-14:LRA=7:TP=-1 -movflags +faststart
            const ffmpegArgs = [
              '-y',
              '-i', inputPath,
              '-c:v', 'libx264',
              '-crf', '18',
              '-preset', 'fast',
              '-pix_fmt', 'yuv420p',
              '-c:a', 'aac',
              '-b:a', '192k',
              '-af', 'loudnorm=I=-14:LRA=7:TP=-1',
              '-movflags', '+faststart',
              outputPath,
            ];

            const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';
            console.log(`[FFmpeg Transcode] Running: ${ffmpegPath} ${ffmpegArgs.join(' ')}`);
            const ffmpegResult = await runCommand(ffmpegPath, ffmpegArgs);
            if (ffmpegResult.code !== 0 || !fs.existsSync(outputPath)) {
              throw new Error(`Erreur FFmpeg (code ${ffmpegResult.code}): ${ffmpegResult.stderr.slice(-800)}`);
            }

            const expectedDuration = Number(req.headers['x-expected-duration']);
            if (!Number.isFinite(expectedDuration) || expectedDuration <= 0) {
              throw new Error('Durée attendue absente ou invalide pour vérifier la vidéo exportée.');
            }
            const probe = await probeMedia(outputPath);
            const hasH264 = probe.streams.some((stream) => stream.codec_type === 'video' && stream.codec_name === 'h264');
            const hasAac = probe.streams.some((stream) => stream.codec_type === 'audio' && stream.codec_name === 'aac');
            if (!probe.formatName.split(',').includes('mp4') || !hasH264 || !hasAac) {
              throw new Error('La sortie vérifiée n’est pas un MP4 H.264/AAC.');
            }
            if (Math.abs(probe.duration - expectedDuration) > 0.5) {
              throw new Error(
                `Durée MP4 invalide : ${probe.duration.toFixed(2)} s au lieu de ${expectedDuration.toFixed(2)} s.`
              );
            }

            const stat = await fs.promises.stat(outputPath);
            console.log(`[FFmpeg Transcode] Verified MP4 H.264/AAC (${probe.duration.toFixed(2)} s)`);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Length', stat.size);
            res.setHeader('Content-Disposition', 'attachment; filename="video-actualite-broadcast.mp4"');

            const readStream = fs.createReadStream(outputPath);
            readStream.on('close', () => void cleanup());
            readStream.on('error', (err) => {
              console.error('[FFmpeg Transcode Stream Error]:', err);
              if (!res.headersSent) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: 'Erreur lors de l’envoi du MP4 vérifié.' }));
              }
              void cleanup();
            });
            readStream.pipe(res);
          } catch (err: any) {
            console.error('[FFmpeg Handler Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message || 'Erreur lors du traitement du flux vidéo.' }));
            await cleanup();
          }
          return;
        }

        next();
      });
    },
  };
}
