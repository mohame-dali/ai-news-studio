import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';

interface TtsWord {
  text: string;
  offsetSec: number;
  durationSec: number;
}

interface TtsCacheEntry {
  audioBase64: string;
  durationSec: number;
  words: TtsWord[];
  mimeType: string;
}

// In-memory cache to ensure instant replay and export
const ttsCache = new Map<string, TtsCacheEntry>();

function cleanTextForTts(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ') // Strip HTML/XML tags
    .replace(/\[\+[^\]]+\]/g, '') // Strip pronunciation brackets like [+phonetics]
    .replace(/\s+/g, ' ')
    .trim();
}

export function viteTtsPlugin(): Plugin {
  return {
    name: 'vite-tts-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();
        const fullUrl = new URL(req.url, 'http://127.0.0.1:3000');

        // Health check endpoint
        if (fullUrl.pathname === '/api/tts/health' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', provider: 'msedge-tts', defaultVoice: 'fr-FR-DeniseNeural' }));
          return;
        }

        // Available French voices endpoint
        if (fullUrl.pathname === '/api/tts/voices' && req.method === 'GET') {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              voices: [
                { id: 'fr-FR-DeniseNeural', name: 'Denise (Française - Naturelle)', gender: 'Female' },
                { id: 'fr-FR-HenriNeural', name: 'Henri (Français - Posé)', gender: 'Male' },
                { id: 'fr-FR-EloiseNeural', name: 'Eloise (Française - Dynamique)', gender: 'Female' },
                { id: 'fr-FR-RemyMultilingualNeural', name: 'Rémy (Multilingue)', gender: 'Male' },
              ],
            })
          );
          return;
        }

        // Main TTS synthesis endpoint
        if (fullUrl.pathname === '/api/tts') {
          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez POST.' }));
            return;
          }

          // Read body chunks
          let bodyStr = '';
          req.on('data', (chunk) => {
            bodyStr += chunk.toString();
          });

          req.on('end', async () => {
            try {
              let parsedBody: { text?: string; voice?: string; rate?: string | number } = {};
              if (bodyStr) {
                try {
                  parsedBody = JSON.parse(bodyStr);
                } catch {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ success: false, error: 'JSON de requête invalide.' }));
                  return;
                }
              }

              const rawText = parsedBody.text || '';
              const cleanText = cleanTextForTts(rawText);
              const voice = parsedBody.voice || 'fr-FR-DeniseNeural';

              if (!cleanText) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(
                  JSON.stringify({
                    success: true,
                    audioBase64: '',
                    durationSec: 0,
                    words: [],
                    mimeType: 'audio/mp3',
                  })
                );
                return;
              }

              // Check cache
              const cacheKey = `${voice}:${cleanText}`;
              if (ttsCache.has(cacheKey)) {
                const cached = ttsCache.get(cacheKey)!;
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, fromCache: true, ...cached }));
                return;
              }

              console.log(`[Edge-TTS] Synthesizing (${voice}): "${cleanText.slice(0, 60)}..."`);

              const tts = new MsEdgeTTS();
              await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, {
                wordBoundaryEnabled: true,
                sentenceBoundaryEnabled: true,
              });

              const resStream = await tts.toStream(cleanText);
              const audioChunks: Buffer[] = [];
              const words: TtsWord[] = [];
              let maxTimeSec = 0;

              if (resStream.metadataStream) {
                resStream.metadataStream.on('data', (chunk) => {
                  try {
                    const parsed = JSON.parse(chunk.toString('utf-8'));
                    for (const item of parsed.Metadata || []) {
                      if (item.Type === 'WordBoundary' && item.Data) {
                        const offsetSec = (item.Data.Offset || 0) / 10000000;
                        const durationSec = (item.Data.Duration || 0) / 10000000;
                        const wordText = item.Data.text?.Text || '';
                        words.push({
                          text: wordText,
                          offsetSec: Math.round(offsetSec * 1000) / 1000,
                          durationSec: Math.round(durationSec * 1000) / 1000,
                        });
                        const endSec = offsetSec + durationSec;
                        if (endSec > maxTimeSec) maxTimeSec = endSec;
                      } else if (item.Type === 'SentenceBoundary' && item.Data) {
                        const sEnd = ((item.Data.Offset || 0) + (item.Data.Duration || 0)) / 10000000;
                        if (sEnd > maxTimeSec) maxTimeSec = sEnd;
                      }
                    }
                  } catch (e) {
                    // Ignore transient parsing errors on chunks
                  }
                });
              }

              resStream.audioStream.on('data', (chunk: Buffer) => {
                audioChunks.push(chunk);
              });

              await Promise.all([
                new Promise<void>((resolve, reject) => {
                  resStream.audioStream.on('end', () => resolve());
                  resStream.audioStream.on('error', reject);
                }),
                resStream.metadataStream
                  ? new Promise<void>((resolve) => {
                      resStream.metadataStream!.on('close', () => resolve());
                      resStream.metadataStream!.on('end', () => resolve());
                      resStream.metadataStream!.on('error', () => resolve());
                    })
                  : Promise.resolve(),
              ]);

              const totalBuffer = Buffer.concat(audioChunks);
              const audioBase64 = `data:audio/mp3;base64,${totalBuffer.toString('base64')}`;

              // Estimate duration from metadata or audio bitrate (48kbps = 6000 bytes/sec)
              let durationSec = maxTimeSec;
              if (durationSec <= 0) {
                durationSec = Math.max(1, Math.round((totalBuffer.length / 6000) * 10) / 10);
              }

              const resultPayload: TtsCacheEntry = {
                audioBase64,
                durationSec: Math.round(durationSec * 100) / 100,
                words,
                mimeType: 'audio/mp3',
              };

              // Cache up to 150 items in memory
              if (ttsCache.size > 150) {
                const firstKey = ttsCache.keys().next().value;
                if (firstKey) ttsCache.delete(firstKey);
              }
              ttsCache.set(cacheKey, resultPayload);

              console.log(
                `[Edge-TTS] Success: ${totalBuffer.length} bytes, duration: ${resultPayload.durationSec}s, ${words.length} words detected`
              );

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, ...resultPayload }));
            } catch (err: any) {
              console.error('[Edge-TTS] Synthesis error:', err);
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Erreur Edge-TTS : ${err.message || String(err)}`,
                })
              );
            }
          });

          return;
        }

        next();
      });
    },
  };
}
