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

            console.log(`[FFmpeg Transcode] Running: ffmpeg ${ffmpegArgs.join(' ')}`);
            const ffmpeg = spawn('/usr/bin/ffmpeg', ffmpegArgs);

            let stderrOutput = '';
            ffmpeg.stderr.on('data', (d) => {
              stderrOutput += d.toString();
            });

            ffmpeg.on('close', async (code) => {
              try {
                if (code === 0 && fs.existsSync(outputPath)) {
                  const stat = await fs.promises.stat(outputPath);
                  console.log(`[FFmpeg Transcode] Success! Output size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);

                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'video/mp4');
                  res.setHeader('Content-Length', stat.size);
                  res.setHeader('Content-Disposition', 'attachment; filename="video-actualite-broadcast.mp4"');

                  const readStream = fs.createReadStream(outputPath);
                  readStream.pipe(res);

                  readStream.on('close', () => {
                    // Safe cleanup of temporary working files
                    fs.promises.unlink(inputPath).catch(() => {});
                    fs.promises.unlink(outputPath).catch(() => {});
                  });
                } else {
                  console.error(`[FFmpeg Transcode] Error exit code ${code}:`, stderrOutput.slice(-800));
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(
                    JSON.stringify({
                      success: false,
                      error: `Erreur FFmpeg (code ${code}): ${stderrOutput.slice(-300)}`,
                    })
                  );
                  fs.promises.unlink(inputPath).catch(() => {});
                  if (fs.existsSync(outputPath)) {
                    fs.promises.unlink(outputPath).catch(() => {});
                  }
                }
              } catch (err: any) {
                console.error('[FFmpeg Transcode Stream Error]:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err.message || 'Erreur interne de transcodage.' }));
              }
            });

            ffmpeg.on('error', (err) => {
              console.error('[FFmpeg Spawn Error]:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: `Impossible de lancer FFmpeg : ${err.message}` }));
              fs.promises.unlink(inputPath).catch(() => {});
            });
          } catch (err: any) {
            console.error('[FFmpeg Handler Error]:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: err.message || 'Erreur lors du traitement du flux vidéo.' }));
            if (fs.existsSync(inputPath)) fs.promises.unlink(inputPath).catch(() => {});
            if (fs.existsSync(outputPath)) fs.promises.unlink(outputPath).catch(() => {});
          }
          return;
        }

        next();
      });
    },
  };
}
