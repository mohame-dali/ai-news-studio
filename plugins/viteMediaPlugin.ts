import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

export interface OpenverseMediaItem {
  id: string | number;
  type: 'image';
  url: string;
  thumbnail: string;
  author: string;
  authorUrl?: string;
  attribution: string;
  width?: number;
  height?: number;
  license: string;
  licenseUrl: string;
  source: 'Openverse';
  title?: string;
}

let openverseQueue: Promise<void> = Promise.resolve();
let lastOpenverseRequestAt = 0;

function fetchOpenverseQueued(url: string): Promise<Response> {
  const request = openverseQueue.then(async () => {
    for (let attempt = 0; attempt <= 2; attempt++) {
      const delay = Math.max(0, 1000 - (Date.now() - lastOpenverseRequestAt));
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      lastOpenverseRequestAt = Date.now();

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'AINewsStudio/1.0 (contact@example.com)',
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });
      if (response.status !== 429 || attempt === 2) return response;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error('Échec inattendu de la requête Openverse.');
  });
  openverseQueue = request.then(() => undefined, () => undefined);
  return request;
}

export function viteMediaPlugin(): Plugin {
  return {
    name: 'vite-media-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();
        const fullUrl = new URL(req.url, 'http://127.0.0.1:3000');

        if (fullUrl.pathname === '/api/media/openverse') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez GET.' }));
            return;
          }

          const rawQuery = fullUrl.searchParams.get('query') || '';
          const query = rawQuery.trim();
          if (!query) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: "Le paramètre 'query' est requis." }));
            return;
          }

          try {
            const endpoint = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm,by&license_type=commercial,modification&page_size=5&filter_dead=true`;
            const openverseRes = await fetchOpenverseQueued(endpoint);
            if (!openverseRes.ok) {
              res.statusCode = openverseRes.status === 429 ? 429 : 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: `Erreur API Openverse : HTTP ${openverseRes.status}` }));
              return;
            }

            const data = (await openverseRes.json()) as {
              results?: Array<{
                id?: string;
                url?: string;
                thumbnail?: string;
                creator?: string;
                creator_url?: string;
                license?: string;
                license_url?: string;
                title?: string;
                width?: number;
                height?: number;
              }>;
            };
            const items: OpenverseMediaItem[] = (data.results || [])
              .filter((item) => typeof item.url === 'string' && /^https?:\/\//i.test(item.url))
              .map((item) => {
                const author = item.creator?.trim() || 'Créateur non indiqué';
                const license = item.license?.trim().toUpperCase() || 'CC BY';
                const licenseUrl = item.license_url || 'https://creativecommons.org/licenses/';
                return {
                  id: item.id || item.url!,
                  type: 'image' as const,
                  url: item.url!,
                  thumbnail: item.thumbnail || item.url!,
                  author,
                  authorUrl: item.creator_url,
                  license,
                  licenseUrl,
                  attribution: `Photo : ${author} / ${license} / Openverse`,
                  width: item.width,
                  height: item.height,
                  title: item.title,
                  source: 'Openverse' as const,
                };
              })
              .sort((a, b) => (b.width || 0) * (b.height || 0) - (a.width || 0) * (a.height || 0));
            const item = items[0] || null;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, query, count: items.length, item, items }));
          } catch (err: unknown) {
            console.error('[Openverse Proxy] Erreur de communication avec l’API :', err);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              success: false,
              error: `Erreur API Openverse : ${err instanceof Error ? err.message : String(err)}`,
            }));
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
