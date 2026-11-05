/**
 * AI News Studio — Openverse openly licensed image acquisition service.
 */

export interface MediaResult {
  id?: string | number;
  url: string;
  type: "video" | "image";
  attribution: string;
  author: string;
  thumbnail: string;
  duration?: number;
  width?: number;
  height?: number;
  license?: string;
  licenseUrl?: string;
  source?: string;
  description?: string;
  title?: string;
}

/**
 * Searches for free, legally licensed media on Wikimedia Commons.
 */
export async function searchWikimediaMedia(query: string, limit = 10): Promise<MediaResult[]> {
  if (!query || !query.trim()) return [];

  try {
    const endpoint = `/api/media/wikimedia?query=${encodeURIComponent(query.trim())}&limit=${limit}`;
    const res = await fetch(endpoint);

    if (!res.ok) {
      console.warn(`[MediaService] Wikimedia search failed HTTP ${res.status}`);
      return [];
    }

    const data = await res.json();
    if (!data.success || !data.items || data.items.length === 0) {
      return [];
    }

    return (data.items as any[]).map((item) => ({
      id: item.id,
      url: item.url,
      type: item.type === "video" ? "video" : "image",
      attribution:
        item.attribution ||
        `Photo : ${item.author || "Contributeur"} / ${item.license || "CC"} / Wikimedia Commons`,
      author: item.author || "Contributeur Wikimedia",
      thumbnail: item.thumbnail || item.url,
      duration: item.duration,
      width: item.width,
      height: item.height,
      license: item.license || "Creative Commons",
      licenseUrl: item.licenseUrl || "https://creativecommons.org/licenses/",
      source: "Wikimedia Commons",
      title: item.title,
      description: item.description,
    }));
  } catch (err) {
    console.warn("[MediaService] Failed to fetch media from Wikimedia API:", err);
    return [];
  }
}

const FRENCH_STOP_WORDS = new Set([
  "le", "la", "les", "l", "un", "une", "des", "du", "de", "d", "au", "aux",
  "et", "ou", "a", "à", "en", "dans", "sur", "pour", "par", "avec", "sans", "sous",
  "ce", "cet", "cette", "ces", "son", "sa", "ses", "leur", "leurs", "mon", "ma", "mes",
  "qui", "que", "quoi", "dont", "où", "est", "sont", "ont", "fait", "faire", "ete", "été",
  "plus", "moins", "tres", "très", "bien", "apres", "après", "avant", "pendant", "depuis",
  "contre", "entre", "vers", "chez", "selon", "comme", "alors", "donc", "mais", "car", "ni",
  "nous", "vous", "ils", "elles", "tout", "tous", "toute", "toutes", "autre", "autres",
  "france", "info", "direct", "actualite", "actualités", "journal", "video", "vidéo", "reportage",
  "edition", "dossier", "flash", "alerte", "live", "news",
]);

/**
 * Extracts 2 to 3 strong topical keywords from the article title and text.
 */
export function extractKeywords(title: string, text: string = ""): string[] {
  const combined = `${title} ${text.slice(0, 300)}`;
  
  // Clean punctuation and normalize
  const tokens = combined
    .toLowerCase()
    .replace(/[«»"'\(\)\[\],.;:!?\/\\]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3 && !FRENCH_STOP_WORDS.has(w) && !/^\d+$/.test(w));

  // Count word frequencies
  const freqMap = new Map<string, number>();
  tokens.forEach((t) => {
    freqMap.set(t, (freqMap.get(t) || 0) + 1);
  });

  // Prioritize capitalized tokens from original title
  const titleTokens = title
    .replace(/[«»"'\(\)\[\],.;:!?\/\\]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !FRENCH_STOP_WORDS.has(w.toLowerCase()));

  const prioritized: string[] = [];

  // Pick first 2 title tokens if available
  for (const t of titleTokens) {
    const clean = t.toLowerCase();
    if (!prioritized.includes(clean)) {
      prioritized.push(clean);
      if (prioritized.length >= 2) break;
    }
  }

  // Complete with most frequent body tokens
  const sortedByFreq = Array.from(freqMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  for (const w of sortedByFreq) {
    if (!prioritized.includes(w)) {
      prioritized.push(w);
      if (prioritized.length >= 3) break;
    }
  }

  return prioritized.length > 0 ? prioritized.slice(0, 3) : ["actualite", "monde"];
}

/**
 * Searches Openverse for openly licensed images matching the given query.
 */
export async function fetchMediaFromOpenverse(query: string): Promise<MediaResult[]> {
  if (!query || !query.trim()) return [];

  try {
    const endpoint = `/api/media/openverse?query=${encodeURIComponent(query.trim())}`;
    const res = await fetch(endpoint);

    if (!res.ok) {
      console.warn(`[MediaService] Recherche Openverse échouée (HTTP ${res.status}).`);
      return [];
    }

    const data = await res.json();
    if (!data.success || !Array.isArray(data.items) || data.items.length === 0) {
      return [];
    }

    return data.items.map((item: any): MediaResult => ({
      id: item.id,
      url: item.url,
      type: "image",
      attribution: item.attribution || `Photo : ${item.author || "Créateur non indiqué"} / ${item.license || "CC BY"} / Openverse`,
      author: item.author || "Créateur non indiqué",
      thumbnail: item.thumbnail || item.url,
      width: item.width,
      height: item.height,
      license: item.license || "CC BY",
      licenseUrl: item.licenseUrl || "https://creativecommons.org/licenses/",
      source: "Openverse",
      title: item.title,
    }));
  } catch (err) {
    console.warn("[MediaService] Échec de la recherche Openverse :", err);
    return [];
  }
}

/**
 * Fetches the best matching Openverse image for an article based on its title and text.
 */
export async function fetchMediaForArticle(
  title: string,
  text: string = ""
): Promise<MediaResult | null> {
  const keywords = extractKeywords(title, text);
  const primaryQuery = keywords.join(" ");

  // 1. Try with the extracted multi-keyword query
  let results = await fetchMediaFromOpenverse(primaryQuery);

  // 2. If no results, try with the primary keyword alone
  if (results.length === 0 && keywords.length > 1) {
    results = await fetchMediaFromOpenverse(keywords[0]);
  }

  return results[0] || null;
}

/**
 * Fetches one Openverse image per script segment. Missing results stay null so
 * the caller can render its existing graphic fallback instead of unrelated media.
 */
export async function fetchMediaCollectionForSegments(
  title: string,
  sentences: string[],
  articleText = ""
): Promise<(MediaResult | null)[]> {
  const results: (MediaResult | null)[] = [];
  const articleKeywords = extractKeywords(title, articleText);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceKeywords = extractKeywords(sentence);
    // Combine segment keyword with article context
    const query = sentenceKeywords.length > 0
      ? `${sentenceKeywords[0]} ${articleKeywords[0] || ""}`.trim()
      : articleKeywords.join(" ");

    const mediaList = await fetchMediaFromOpenverse(query);
    results.push(mediaList[0] || null);
  }

  return results;
}
