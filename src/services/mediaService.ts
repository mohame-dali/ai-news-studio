/**
 * AI News Studio — Pexels Legal Media Acquisition Service
 * Extracts relevant keywords from news articles and queries the server Pexels proxy
 * to retrieve real, high-quality, royalty-free B-roll videos and images with proper attribution.
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
 * Searches for Pexels B-roll media matching the given query keywords.
 */
export async function searchPexelsMedia(query: string, perPage = 5): Promise<MediaResult[]> {
  if (!query || !query.trim()) return [];

  try {
    const endpoint = `/api/media/search?query=${encodeURIComponent(query.trim())}&per_page=${perPage}`;
    const res = await fetch(endpoint);

    if (!res.ok) {
      console.warn(`[MediaService] Pexels search failed HTTP ${res.status}`);
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
      attribution: item.attribution || `Média : ${item.author || "Pexels"} / Pexels`,
      author: item.author || "Pexels",
      thumbnail: item.thumbnail || item.url,
      duration: item.duration,
      width: item.width,
      height: item.height,
    }));
  } catch (err) {
    console.warn("[MediaService] Failed to fetch media from Pexels API:", err);
    return [];
  }
}

/**
 * Fetches the best matching Pexels media for an article based on its title and text.
 * Falls back to broader topical keywords if the specific search yields no results.
 */
export async function fetchMediaForArticle(
  title: string,
  text: string = ""
): Promise<MediaResult | null> {
  const keywords = extractKeywords(title, text);
  const primaryQuery = keywords.join(" ");

  // 1. Try with the extracted multi-keyword query
  let results = await searchPexelsMedia(primaryQuery, 5);

  // 2. If no results, try with the primary keyword alone
  if (results.length === 0 && keywords.length > 1) {
    results = await searchPexelsMedia(keywords[0], 5);
  }

  // 3. Fallback to general news/editorial B-roll terms if still nothing
  if (results.length === 0) {
    results = await searchPexelsMedia("news journalism", 3);
  }

  if (results.length === 0) {
    return null;
  }

  // Prefer video over image for moving background
  const bestVideo = results.find((r) => r.type === "video");
  return bestVideo || results[0];
}

/**
 * Fetches multiple B-roll media items for a multi-segment news script.
 */
export async function fetchMediaCollectionForSegments(
  title: string,
  sentences: string[]
): Promise<(MediaResult | null)[]> {
  const results: (MediaResult | null)[] = [];
  const articleKeywords = extractKeywords(title);

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    const sentenceKeywords = extractKeywords(sentence);
    // Combine segment keyword with article context
    const query = sentenceKeywords.length > 0
      ? `${sentenceKeywords[0]} ${articleKeywords[0] || ""}`.trim()
      : articleKeywords.join(" ");

    const mediaList = await searchPexelsMedia(query, 3);
    const chosen = mediaList.find((m) => m.type === "video") || mediaList[0] || null;
    results.push(chosen);
  }

  return results;
}
