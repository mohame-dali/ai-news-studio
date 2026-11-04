import type { Plugin } from 'vite';
import * as cheerio from 'cheerio';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import Parser from 'rss-parser';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import ipaddr from 'ipaddr.js';
import { lookup } from 'node:dns/promises';
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_RANGES = new Set([
  'loopback',
  'private',
  'linkLocal',
  'carrierGradeNat',
  'reserved',
  'unspecified',
  'broadcast',
  'uniqueLocal',
]);

/**
 * Validates whether a target URL is safe to fetch (anti-SSRF check).
 * Rejects non-HTTP(S) protocols and all private, loopback, link-local,
 * carrier-grade NAT, or reserved IPv4/IPv6 address ranges.
 */
async function isUrlForbidden(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return true;
  }

  // Reject non-http(s) protocols
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return true;
  }

  const hostname = parsed.hostname.toLowerCase();

  // Strip enclosing brackets for IPv6 literals e.g. [::1] -> ::1
  const cleanHost = hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  // Reject localhost or local domain suffixes
  if (
    cleanHost === 'localhost' ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local') ||
    cleanHost.endsWith('.internal') ||
    cleanHost.endsWith('.onion')
  ) {
    return true;
  }

  // Check if hostname is an IP literal
  if (ipaddr.isValid(cleanHost)) {
    try {
      const addr = ipaddr.process(cleanHost);
      if (FORBIDDEN_RANGES.has(addr.range())) {
        return true;
      }
    } catch {
      return true;
    }
  }

  // Resolve hostname via DNS and check all resolved IP addresses
  try {
    const records = await lookup(cleanHost, { all: true });
    if (!records || records.length === 0) {
      return true;
    }
    for (const record of records) {
      if (ipaddr.isValid(record.address)) {
        const addr = ipaddr.process(record.address);
        if (FORBIDDEN_RANGES.has(addr.range())) {
          return true;
        }
      }
    }
  } catch {
    // If hostname cannot be resolved, reject request to prevent SSRF against internal hosts
    return true;
  }

  return false;
}

export interface NewsSourceConfig {
  id: string;
  name: string;
  url: string;
  region: 'france' | 'europe' | 'monde';
  enabled: boolean;
  notes?: string;
  custom?: boolean;
}

export interface RawNewsItem {
  id: string;
  title: string;
  link: string;
  pubDate: string;
  source: string;
  sourceId: string;
  region: 'france' | 'europe' | 'monde';
}

export interface NewsGroupItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceId: string;
  pubDate: string;
  region: 'france' | 'europe' | 'monde';
  relatedSources: string[];
  sourceCount: number;
}

function normalizeTitleTokens(t: string): string[] {
  const stopwords = new Set([
    'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'd', 'en', 'a', 'au', 'aux',
    'par', 'pour', 'sur', 'dans', 'avec', 'et', 'ou', 'ce', 'cette', 'ces', 'est',
    'sont', 'direct', 'live', 'video', 'info', 'fil', 'actualite', 'france', 'alerte',
    'apres', 'selon', 'vers', 'contre', 'entre', 'sans', 'sous', 'chez'
  ]);
  return t
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopwords.has(w));
}

function computeTokenSimilarity(tokens1: string[], tokens2: string[]): number {
  if (!tokens1.length || !tokens2.length) return 0;
  const set1 = new Set(tokens1);
  const set2 = new Set(tokens2);
  let intersection = 0;
  for (const t of set1) {
    if (set2.has(t)) intersection++;
  }
  return intersection / Math.min(set1.size, set2.size);
}

export function groupSimilarNews(rawItems: RawNewsItem[], threshold = 0.40): NewsGroupItem[] {
  const groups: {
    representative: RawNewsItem;
    relatedSources: Set<string>;
    tokens: string[];
  }[] = [];

  for (const item of rawItems) {
    const tokens = normalizeTitleTokens(item.title);
    let matchedGroup: (typeof groups)[0] | null = null;

    for (const g of groups) {
      const sim = computeTokenSimilarity(tokens, g.tokens);
      if (sim >= threshold) {
        matchedGroup = g;
        break;
      }
    }

    if (matchedGroup) {
      if (item.source !== matchedGroup.representative.source) {
        matchedGroup.relatedSources.add(item.source);
      }
    } else {
      groups.push({
        representative: { ...item },
        relatedSources: new Set(),
        tokens,
      });
    }
  }

  return groups.map((g, idx) => {
    const rep = g.representative;
    const related = Array.from(g.relatedSources);
    return {
      id: `group-${idx + 1}-${rep.id.slice(0, 12)}`,
      title: rep.title,
      link: rep.link,
      source: rep.source,
      sourceId: rep.sourceId,
      pubDate: rep.pubDate,
      region: rep.region,
      relatedSources: related,
      sourceCount: 1 + related.length,
    };
  });
}

// In-memory runtime state & cache
const customSources: NewsSourceConfig[] = [];
let trendingCache: {
  data: {
    items: NewsGroupItem[];
    sources: Array<{ id: string; name: string; region: string; ok: boolean; count: number; error?: string }>;
    cachedAt: string;
  };
  timestamp: number;
} | null = null;
const CACHE_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function loadConfiguredSources(): NewsSourceConfig[] {
  try {
    const configPath = path.resolve(process.cwd(), 'src/config/newsSources.json');
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return [...parsed, ...customSources];
      }
    }
  } catch (err) {
    console.warn('[NewsSources] Error loading newsSources.json, using defaults:', err);
  }
  return [
    {
      id: 'lemonde-une',
      name: 'Le Monde (La Une)',
      url: 'https://www.lemonde.fr/rss/une.xml',
      region: 'france',
      enabled: true,
    },
    {
      id: 'bfmtv-news',
      name: 'BFMTV (Fil Continu)',
      url: 'https://www.bfmtv.com/rss/news-24-7/',
      region: 'france',
      enabled: true,
    },
    {
      id: 'google-news-fr',
      name: 'Google Actualités France',
      url: 'https://news.google.com/rss?hl=fr&gl=FR&ceid=FR:fr',
      region: 'france',
      enabled: true,
    },
    {
      id: 'euronews-fr',
      name: 'Euronews (Europe)',
      url: 'https://fr.euronews.com/rss',
      region: 'europe',
      enabled: true,
    },
    ...customSources,
  ];
}

export async function fetchFeedLimited(url: string, maxBytes = 2 * 1024 * 1024, timeoutMs = 8000): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      Accept: 'application/rss+xml, application/xml, text/xml, */*',
      'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} (${res.statusText})`);
  }

  const contentLength = res.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    throw new Error('Flux RSS trop volumineux (> 2 Mo)');
  }

  const text = await res.text();
  if (text.length > maxBytes) {
    throw new Error('Flux RSS trop volumineux (> 2 Mo)');
  }
  return text;
}

function parseJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 512 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function viteScrapingPlugin(): Plugin {
  return {
    name: 'vite-scraping-plugin',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (!req.url) return next();
        const fullUrl = new URL(req.url, 'http://127.0.0.1:3000');

        // Scrape URL endpoint
        if (fullUrl.pathname === '/api/scrape-url') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez GET.' }));
            return;
          }

          const targetUrl = fullUrl.searchParams.get('url');
          if (!targetUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: "Le paramètre 'url' est obligatoire." }));
            return;
          }

          // Anti-SSRF check: validate protocol and destination IP ranges
          if (await isUrlForbidden(targetUrl)) {
            console.warn(`[SSRF Blocked] Refusing access to forbidden URL: ${targetUrl}`);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid or forbidden URL' }));
            return;
          }

          try {
            const parsedTarget = new URL(targetUrl);
            console.log('[Scraper] Fetching:', targetUrl);

            let currentUrl = targetUrl;
            let response = await fetch(currentUrl, {
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept':
                  'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'document',
                'sec-fetch-mode': 'navigate',
                'sec-fetch-site': 'none',
                'sec-fetch-user': '?1',
                'upgrade-insecure-requests': '1',
                'Cache-Control': 'no-cache',
              },
              redirect: 'manual',
              signal: AbortSignal.timeout(15000),
            });

            // Prevent redirect-based SSRF (manual validation of hop destinations)
            let redirects = 0;
            while ([301, 302, 303, 307, 308].includes(response.status) && redirects < 3) {
              const redirectLocation = response.headers.get('location');
              if (!redirectLocation) break;
              currentUrl = new URL(redirectLocation, currentUrl).toString();
              if (await isUrlForbidden(currentUrl)) {
                console.warn(`[SSRF Blocked] Refusing redirect to forbidden URL: ${currentUrl}`);
                res.statusCode = 400;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: 'Invalid or forbidden URL' }));
                return;
              }
              redirects++;
              response = await fetch(currentUrl, {
                headers: {
                  'User-Agent':
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                  'Accept':
                    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                  'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
                  'Cache-Control': 'no-cache',
                },
                redirect: 'manual',
                signal: AbortSignal.timeout(15000),
              });
            }

            if (!response.ok) {
              res.statusCode = response.status >= 400 && response.status < 600 ? response.status : 502;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: `Échec d'accès au site web (HTTP ${response.status} : ${response.statusText}).`,
                })
              );
              return;
            }

            const html = await response.text();
            const $ = cheerio.load(html);

            // Extract metadata from raw HTML before any DOM manipulation
            let title =
              $('meta[property="og:title"]').attr('content') ||
              $('meta[name="twitter:title"]').attr('content') ||
              $('h1').first().text() ||
              $('title').text() ||
              '';
            title = title.replace(/\s+/g, ' ').trim();

            let image =
              $('meta[property="og:image"]').attr('content') ||
              $('meta[name="twitter:image"]').attr('content') ||
              $('meta[property="og:image:url"]').attr('content') ||
              $('article img').first().attr('src') ||
              $('main img').first().attr('src');

            if (image && !image.startsWith('http://') && !image.startsWith('https://')) {
              try {
                image = new URL(image, targetUrl).toString();
              } catch {
                image = undefined;
              }
            }

            const publisher =
              $('meta[property="og:site_name"]').attr('content') ||
              $('meta[name="application-name"]').attr('content') ||
              parsedTarget.hostname.replace(/^www\./, '');

            let author: string | undefined =
              $('meta[name="author"]').attr('content') ||
              $('meta[property="article:author"]').attr('content') ||
              $('[rel="author"]').first().text().trim() ||
              $('.author, .byline').first().text().trim() ||
              undefined;

            const pubdate =
              $('meta[property="article:published_time"]').attr('content') ||
              $('meta[name="publish-date"]').attr('content') ||
              $('time').first().attr('datetime') ||
              $('time').first().text().trim() ||
              new Date().toISOString();

            let content = '';
            let paragraphs: string[] = [];

            // Primary extraction: Mozilla Readability via JSDOM
            try {
              const dom = new JSDOM(html, { url: targetUrl });
              const reader = new Readability(dom.window.document);
              const article = reader.parse();

              if (article && article.textContent && article.textContent.trim().length > 100) {
                if (article.title && (!title || title.length < 5)) {
                  title = article.title.replace(/\s+/g, ' ').trim();
                }
                if (article.byline && !author) {
                  author = article.byline.trim();
                }

                if (article.content) {
                  const $art = cheerio.load(article.content);
                  paragraphs = $art('p')
                    .map((_, el) => $art(el).text().replace(/\s+/g, ' ').trim())
                    .get()
                    .filter(
                      (p) =>
                        p.length > 25 &&
                        !p.toLowerCase().includes('cookie') &&
                        !p.toLowerCase().includes('droits réservés') &&
                        !p.toLowerCase().includes('abonn')
                    );
                }

                if (paragraphs.length < 2) {
                  paragraphs = article.textContent
                    .split(/\n\s*\n/)
                    .map((p) => p.replace(/\s+/g, ' ').trim())
                    .filter((p) => p.length > 25);
                }

                content = paragraphs.length > 0 ? paragraphs.join('\n\n').trim() : article.textContent.trim();
              }
            } catch (readabilityError) {
              console.warn('[Scraper] Readability parsing error, falling back to Cheerio:', readabilityError);
            }

            // Fallback: Cheerio selector extraction if Readability produced insufficient text
            if (!content || content.length < 50) {
              // Strip non-content scripts and banners
              $(
                'script, style, noscript, iframe, svg, nav, header, footer, aside, .ad, .ads, .advertisement, .cookie-banner, .social-share, .share-buttons, .newsletter, .subscription-box'
              ).remove();

              paragraphs = [];
              const articleContainers = [
                'article',
                '[role="main"]',
                'main',
                '.article-body',
                '.story-body',
                '.post-content',
                '.content-body',
                '#article-body',
                '.entry-content',
              ];

              for (const selector of articleContainers) {
                if ($(selector).length > 0) {
                  $(selector)
                    .find('p')
                    .each((_, el) => {
                      const text = $(el).text().replace(/\s+/g, ' ').trim();
                      if (
                        text.length > 25 &&
                        !text.toLowerCase().includes('cookie') &&
                        !text.toLowerCase().includes('droits réservés') &&
                        !text.toLowerCase().includes('abonn')
                      ) {
                        paragraphs.push(text);
                      }
                    });
                  if (paragraphs.length >= 2) break;
                }
              }

              if (paragraphs.length < 2) {
                paragraphs = [];
                $('p').each((_, el) => {
                  const text = $(el).text().replace(/\s+/g, ' ').trim();
                  if (
                    text.length > 35 &&
                    !text.toLowerCase().includes('cookie') &&
                    !text.toLowerCase().includes('abonn') &&
                    !text.toLowerCase().includes('newsletter')
                  ) {
                    paragraphs.push(text);
                  }
                });
              }

              content = paragraphs.join('\n\n').trim();
            }

            if (!content || content.length < 50) {
              res.statusCode = 422;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error:
                    "Aucun corps de texte substantiel n'a pu être extrait de cette page (possible mur d'abonnement, paywall ou rendu dynamique non accessible).",
                })
              );
              return;
            }

            console.log('[Scraper] Extraction successful');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                url: targetUrl,
                title,
                content,
                image,
                publisher,
                author,
                pubdate,
                paragraphCount: paragraphs.length,
              })
            );
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: `Erreur d'extraction web : ${err.message || String(err)}`,
              })
            );
          }
          return;
        }

        // Fetch RSS endpoint
        if (fullUrl.pathname === '/api/fetch-rss') {
          if (req.method !== 'GET') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Méthode non autorisée. Utilisez GET.' }));
            return;
          }

          const rssUrl = fullUrl.searchParams.get('url');
          if (!rssUrl) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: "Le paramètre 'url' du flux RSS est requis." }));
            return;
          }

          // Anti-SSRF check: validate protocol and destination IP ranges
          if (await isUrlForbidden(rssUrl)) {
            console.warn(`[SSRF Blocked] Refusing access to forbidden RSS URL: ${rssUrl}`);
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: false, error: 'Invalid or forbidden URL' }));
            return;
          }

          try {
            console.log('[Scraper] Fetching RSS:', rssUrl);
            const parser = new Parser({
              headers: {
                'User-Agent':
                  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml, text/xml, */*',
                'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
              },
              timeout: 15000,
            });

            const feed = await parser.parseURL(rssUrl);

            if (!feed.items || feed.items.length === 0) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: 'Le flux RSS est valide mais ne comporte aucun article récent.',
                })
              );
              return;
            }

            const items = feed.items.map((item) => {
              const rawContent =
                (item as any)['content:encoded'] ||
                item.content ||
                item.summary ||
                item.contentSnippet ||
                '';
              let cleanContent = rawContent;
              if (typeof cleanContent === 'string' && cleanContent.includes('<')) {
                const $clean = cheerio.load(cleanContent);
                cleanContent = $clean.text().replace(/\s+/g, ' ').trim();
              }

              let image: string | undefined = undefined;
              if (item.enclosure?.url && item.enclosure.type?.startsWith('image')) {
                image = item.enclosure.url;
              } else if (typeof rawContent === 'string' && rawContent.includes('<img')) {
                const match = rawContent.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (match && match[1]) {
                  image = match[1];
                }
              }

              return {
                title: item.title || 'Actualité sans titre',
                link: item.link || '',
                pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
                content: cleanContent,
                contentSnippet: item.contentSnippet || (typeof cleanContent === 'string' ? cleanContent.slice(0, 250) : ''),
                author: item.creator || (item as any).author,
                image,
              };
            });

            console.log('[Scraper] RSS Extraction successful');

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                title: feed.title || 'Flux RSS',
                description: feed.description || '',
                link: feed.link || rssUrl,
                items,
              })
            );
          } catch (err: any) {
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: `Impossible de récupérer le flux RSS : ${err.message || String(err)}`,
              })
            );
          }
          return;
        }

        // GET /api/news/sources: List all news sources (base config + custom)
        if (fullUrl.pathname === '/api/news/sources' && req.method === 'GET') {
          const allSources = loadConfiguredSources();
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, sources: allSources }));
          return;
        }

        // POST /api/news/sources: Add custom RSS feed with SSRF guard & validation
        if (fullUrl.pathname === '/api/news/sources' && req.method === 'POST') {
          try {
            const body = await parseJsonBody(req);
            const rawUrl = typeof body?.url === 'string' ? body.url.trim() : '';

            if (!rawUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: "L'adresse URL du flux RSS est requise." }));
              return;
            }

            // Anti-SSRF check: validate protocol and destination IP ranges
            if (await isUrlForbidden(rawUrl)) {
              console.warn(`[SSRF Blocked] Refusing custom feed URL: ${rawUrl}`);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: 'URL interdite ou non autorisée (SSRF)' }));
              return;
            }

            // Test fetch and parse XML
            const parser = new Parser();
            const xml = await fetchFeedLimited(rawUrl, 2 * 1024 * 1024, 8000);
            const parsedFeed = await parser.parseString(xml);

            if (!parsedFeed || !parsedFeed.items || parsedFeed.items.length === 0) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(
                JSON.stringify({
                  success: false,
                  error: "Le flux RSS est valide mais ne comporte aucun article récent.",
                })
              );
              return;
            }

            const region = (['france', 'europe', 'monde'].includes(body.region) ? body.region : 'france') as
              | 'france'
              | 'europe'
              | 'monde';
            const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim() : parsedFeed.title || 'Flux personnalisé';

            const newSource: NewsSourceConfig = {
              id: `custom-${Date.now()}`,
              name,
              url: rawUrl,
              region,
              enabled: true,
              notes: `Ajouté manuellement par la rédaction (${parsedFeed.items.length} articles)`,
              custom: true,
            };

            customSources.push(newSource);
            // Invalidate cache so the new feed appears in trending
            trendingCache = null;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                source: newSource,
                itemCount: parsedFeed.items.length,
              })
            );
          } catch (err: any) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: false,
                error: `Impossible de valider ce flux RSS : ${err.message || String(err)}`,
              })
            );
          }
          return;
        }

        // GET /api/news/trending: Multi-source feed aggregator with deduplication
        if (fullUrl.pathname === '/api/news/trending' && req.method === 'GET') {
          const forceRefresh = fullUrl.searchParams.get('refresh') === 'true' || fullUrl.searchParams.get('refresh') === '1';

          // Return cached data if still fresh (15 minutes)
          if (!forceRefresh && trendingCache && Date.now() - trendingCache.timestamp < CACHE_DURATION_MS) {
            const ageMinutes = Math.floor((Date.now() - trendingCache.timestamp) / 60000);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                success: true,
                items: trendingCache.data.items,
                sources: trendingCache.data.sources,
                cachedAt: trendingCache.data.cachedAt,
                cacheAgeMinutes: ageMinutes,
                isCached: true,
              })
            );
            return;
          }

          const allSources = loadConfiguredSources();
          const enabledSources = allSources.filter((s) => s.enabled);
          const parser = new Parser({
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
              Accept: 'application/rss+xml, application/xml, text/xml, */*',
              'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            timeout: 8000,
          });

          // Fetch all feeds concurrently with Promise.allSettled
          const feedResults = await Promise.allSettled(
            enabledSources.map(async (src) => {
              // 1. SSRF check
              if (await isUrlForbidden(src.url)) {
                throw new Error('URL interdite par le filtre de sécurité SSRF');
              }

              // 2. Fetch with 8s timeout and 2MB limit
              const xml = await fetchFeedLimited(src.url, 2 * 1024 * 1024, 8000);
              const feed = await parser.parseString(xml);
              const items: RawNewsItem[] = (feed.items || []).map((item, idx) => {
                return {
                  id: `${src.id}-${idx}-${Date.now().toString(36)}`,
                  title: (item.title || 'Actualité sans titre').replace(/\s+/g, ' ').trim(),
                  link: item.link || '',
                  pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
                  source: src.name,
                  sourceId: src.id,
                  region: src.region,
                };
              });

              return {
                source: src,
                items,
              };
            })
          );

          const sourcesReport: Array<{
            id: string;
            name: string;
            region: string;
            ok: boolean;
            count: number;
            error?: string;
          }> = [];

          const collectedRawItems: RawNewsItem[] = [];

          feedResults.forEach((resItem, i) => {
            const src = enabledSources[i];
            if (resItem.status === 'fulfilled') {
              sourcesReport.push({
                id: src.id,
                name: src.name,
                region: src.region,
                ok: true,
                count: resItem.value.items.length,
              });
              collectedRawItems.push(...resItem.value.items);
            } else {
              sourcesReport.push({
                id: src.id,
                name: src.name,
                region: src.region,
                ok: false,
                count: 0,
                error: resItem.reason instanceof Error ? resItem.reason.message : String(resItem.reason),
              });
            }
          });

          // Deduplicate and group news by topic similarity
          const groupedItems = groupSimilarNews(collectedRawItems, 0.40);

          const nowIso = new Date().toISOString();
          trendingCache = {
            data: {
              items: groupedItems,
              sources: sourcesReport,
              cachedAt: nowIso,
            },
            timestamp: Date.now(),
          };

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              success: true,
              items: groupedItems,
              sources: sourcesReport,
              cachedAt: nowIso,
              cacheAgeMinutes: 0,
              isCached: false,
            })
          );
          return;
        }

        next();
      });
    },
  };
}
