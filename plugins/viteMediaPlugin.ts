import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

export interface PexelsMediaItem {
  id: string | number;
  type: 'video' | 'image';
  url: string;
  thumbnail: string;
  author: string;
  authorUrl?: string;
  attribution: string;
  width?: number;
  height?: number;
  duration?: number;
}

export function viteMediaPlugin(): Plugin {
  return {
    name: 'vite-media-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();
        const fullUrl = new URL(req.url, 'http://127.0.0.1:3000');

        // Pexels search endpoint
        if (fullUrl.pathname === '/api/media/search') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez GET.' }));
            return;
          }

          const rawQuery = fullUrl.searchParams.get('query') || '';
          const query = rawQuery.trim();
          const perPage = Math.min(10, Math.max(1, parseInt(fullUrl.searchParams.get('per_page') || '5', 10)));
          const apiKey = process.env.PEXELS_API_KEY?.trim();

          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: "Le paramètre 'query' est requis." }));
            return;
          }

          if (!apiKey) {
            console.warn('[Pexels Proxy] Variable d\'environnement PEXELS_API_KEY absente. Retour de liste vide.');
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                apiKeyConfigured: false,
                query,
                videos: [],
                images: [],
                items: [],
                warning: 'PEXELS_API_KEY non configurée. Définissez PEXELS_API_KEY dans votre fichier .env pour activer la recherche B-roll légale.',
              })
            );
            return;
          }

          try {
            console.log(`[Pexels Proxy] Searching B-roll videos for query: "${query}"`);

            // 1. Search Videos
            const videoEndpoint = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}`;
            const videoRes = await fetch(videoEndpoint, {
              headers: {
                Authorization: apiKey,
                'User-Agent': 'AINewsStudio/1.0',
              },
              signal: AbortSignal.timeout(10000),
            });

            const videos: PexelsMediaItem[] = [];

            if (videoRes.ok) {
              const videoData = (await videoRes.json()) as any;
              for (const v of videoData.videos || []) {
                // Find best portrait mp4 file
                const files = v.video_files || [];
                const portraitMp4 = files.find(
                  (f: any) => f.height >= f.width && f.file_type === 'video/mp4'
                );
                const hdMp4 = files.find((f: any) => f.quality === 'hd' && f.file_type === 'video/mp4');
                const anyMp4 = files.find((f: any) => f.file_type === 'video/mp4');
                const chosen = portraitMp4 || hdMp4 || anyMp4 || files[0];

                if (chosen?.link) {
                  const authorName = v.user?.name || 'Créateur Pexels';
                  videos.push({
                    id: v.id,
                    type: 'video',
                    url: chosen.link,
                    thumbnail: v.image || chosen.link,
                    author: authorName,
                    authorUrl: v.user?.url,
                    attribution: `Vidéo : ${authorName} / Pexels`,
                    width: chosen.width || v.width,
                    height: chosen.height || v.height,
                    duration: v.duration,
                  });
                }
              }
            } else {
              console.warn(`[Pexels Proxy] Video search returned HTTP ${videoRes.status}: ${videoRes.statusText}`);
            }

            // 2. Search Photos (if fewer than 2 videos found or as complementary B-roll)
            const images: PexelsMediaItem[] = [];
            if (videos.length < 2) {
              try {
                const photoEndpoint = `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=${perPage}`;
                const photoRes = await fetch(photoEndpoint, {
                  headers: {
                    Authorization: apiKey,
                    'User-Agent': 'AINewsStudio/1.0',
                  },
                  signal: AbortSignal.timeout(10000),
                });

                if (photoRes.ok) {
                  const photoData = (await photoRes.json()) as any;
                  for (const p of photoData.photos || []) {
                    const authorName = p.photographer || 'Photographe Pexels';
                    const imageUrl = p.src?.large2x || p.src?.large || p.src?.portrait || p.src?.original;
                    if (imageUrl) {
                      images.push({
                        id: p.id,
                        type: 'image',
                        url: imageUrl,
                        thumbnail: p.src?.medium || imageUrl,
                        author: authorName,
                        authorUrl: p.photographer_url,
                        attribution: `Photo : ${authorName} / Pexels`,
                        width: p.width,
                        height: p.height,
                      });
                    }
                  }
                }
              } catch (photoErr) {
                console.warn('[Pexels Proxy] Secondary photo search failed:', photoErr);
              }
            }

            const combinedItems = [...videos, ...images];

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                apiKeyConfigured: true,
                query,
                count: combinedItems.length,
                videos,
                images,
                items: combinedItems,
              })
            );
          } catch (err: any) {
            console.error('[Pexels Proxy] Error communicating with Pexels API:', err);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: `Erreur API Pexels : ${err.message || String(err)}`,
              })
            );
          }
          return;
        }

        // Wikimedia Commons legal media search endpoint
        if (fullUrl.pathname === '/api/media/wikimedia') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez GET.' }));
            return;
          }

          const rawQuery = fullUrl.searchParams.get('query') || '';
          const query = rawQuery.trim();
          const limit = Math.min(20, Math.max(1, parseInt(fullUrl.searchParams.get('limit') || '10', 10)));

          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: "Le paramètre 'query' est requis." }));
            return;
          }

          try {
            console.log(`[Wikimedia Search] Query: "${query}"`);
            const endpoint = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrnamespace=6&prop=imageinfo&iiprop=url|extmetadata|dimensions&iiurlwidth=800&gsrlimit=${limit}&format=json`;

            const wikiRes = await fetch(endpoint, {
              headers: {
                'User-Agent': 'AINewsStudio/1.0 (editorial-compliance@ainewsstudio.org)',
                'Accept': 'application/json',
              },
              signal: AbortSignal.timeout(10000),
            });

            if (!wikiRes.ok) {
              res.statusCode = wikiRes.status >= 400 && wikiRes.status < 600 ? wikiRes.status : 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: `Erreur API Wikimedia : HTTP ${wikiRes.status}` }));
              return;
            }

            const data = (await wikiRes.json()) as any;
            const pages = data?.query?.pages ? Object.values(data.query.pages) : [];

            function cleanHtml(htmlStr: string): string {
              if (!htmlStr) return '';
              return htmlStr
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                .replace(/<[^>]*>?/gm, '') // Strip all HTML tags
                .replace(/&amp;/g, '&')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&quot;/g, '"')
                .replace(/&#039;|&apos;|&#39;/g, "'")
                .replace(/&nbsp;/g, ' ')
                .replace(/https?:\/\/\S+/gi, '') // Remove naked URLs from author names
                .replace(/\s+/g, ' ')
                .trim();
            }

            const items = pages
              .map((page: any) => {
                const info = page.imageinfo?.[0];
                if (!info || !info.url) return null;

                const cleanUrl = info.url.split('?')[0].toLowerCase();
                const isSupported =
                  cleanUrl.endsWith('.jpg') ||
                  cleanUrl.endsWith('.jpeg') ||
                  cleanUrl.endsWith('.png') ||
                  cleanUrl.endsWith('.webp') ||
                  cleanUrl.endsWith('.svg') ||
                  cleanUrl.endsWith('.mp4') ||
                  cleanUrl.endsWith('.webm');
                if (!isSupported) return null;

                const meta = info.extmetadata || {};
                const rawArtist = meta.Artist?.value || meta.Credit?.value || '';
                const artist = cleanHtml(rawArtist) || 'Contributeur Wikimedia Commons';
                const license = cleanHtml(meta.LicenseShortName?.value || meta.License?.value || meta.UsageTerms?.value || 'Creative Commons');
                const licenseUrl = meta.LicenseUrl?.value || 'https://creativecommons.org/licenses/';
                const desc = cleanHtml(meta.ImageDescription?.value || meta.ObjectName?.value || page.title?.replace(/^File:/, '') || '');
                const cleanTitle = cleanHtml(page.title?.replace(/^File:/, '') || 'Média Wikimedia');
                const isVideo = cleanUrl.endsWith('.mp4') || cleanUrl.endsWith('.webm');

                return {
                  id: String(page.pageid || Math.random()),
                  title: cleanTitle,
                  type: isVideo ? 'video' : 'image',
                  url: info.url,
                  thumbnail: info.thumburl || info.url,
                  author: artist,
                  license,
                  licenseUrl,
                  attribution: `Photo : ${artist} / ${license} / Wikimedia Commons`,
                  description: desc,
                  width: info.width,
                  height: info.height,
                  source: 'Wikimedia Commons',
                };
              })
              .filter(Boolean);

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, count: items.length, items }));
          } catch (err: any) {
            console.error('[Wikimedia Search] Error:', err);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: `Erreur lors de la recherche Wikimedia : ${err.message || String(err)}`,
              })
            );
          }
          return;
        }

        next();
      });
    },
  };
}
