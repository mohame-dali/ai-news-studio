import {
  ArticleSourceData,
  CameraMovement,
  Config,
  ManuscriptType,
  MediaAssetType,
  Mood,
  SegmentType,
  TextPlacement,
} from "@/types";
import { extractFactsWithOllama, generateSectionWithOllama } from "@/services/ollamaClient";
import { DURATION_PRESETS, isSensitiveTopic } from "./constants";
import { fetchMediaCollectionForSegments, MediaResult } from "@/services/mediaService";

/**
 * Scrapes a real web article using the Vite backend proxy /api/scrape-url
 */
async function scrapeRealArticle(targetUrl: string): Promise<{
  title: string;
  content: string;
  image?: string;
  publisher?: string;
  author?: string;
  pubdate?: string;
  url: string;
}> {
  const endpoint = `/api/scrape-url?url=${encodeURIComponent(targetUrl)}`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    let errorDetail = `Code HTTP ${response.status} (${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorDetail = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(`Échec de l'extraction de l'article : ${errorDetail}`);
  }

  const data = await response.json();
  if (!data.success || !data.content || data.content.trim().length < 200) {
    throw new Error(
      data.error ||
        "Le texte extrait contient moins de 200 caractères. Collez manuellement le texte de l'article pour poursuivre."
    );
  }

  return data;
}

/**
 * Fetches real RSS items using the Vite backend proxy /api/fetch-rss
 */
async function fetchRealRss(rssUrl: string): Promise<{
  title: string;
  description: string;
  link: string;
  items: Array<{
    title: string;
    link: string;
    pubDate: string;
    content: string;
    contentSnippet: string;
    author?: string;
    image?: string;
  }>;
}> {
  const endpoint = `/api/fetch-rss?url=${encodeURIComponent(rssUrl)}`;
  const response = await fetch(endpoint);

  if (!response.ok) {
    let errorDetail = `Code HTTP ${response.status}`;
    try {
      const errJson = await response.json();
      if (errJson?.error) errorDetail = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(`Échec du chargement du flux RSS : ${errorDetail}`);
  }

  const data = await response.json();
  if (!data.success || !data.items || data.items.length === 0) {
    throw new Error(data.error || "Le flux RSS est valide mais ne contient aucun article récent.");
  }

  return data;
}

export async function generateManuscriptFromInput(
  fetcherId: string,
  inputs: Record<string, string>,
  config: Config,
  options: { durationOption?: "court" | "standard" | "long"; onProgress?: (message: string) => void } = {}
): Promise<{ projectId: string; manuscript: ManuscriptType; sourceArticle?: ArticleSourceData }> {
  let title = "";
  let byline = "Rédaction AI News Studio";
  let content = "";
  let publisher: string | undefined = undefined;
  let author: string | undefined = undefined;
  let sourceUrl: string | undefined = undefined;
  let pubdate = new Date().toISOString();
  let articleImage: string | undefined = undefined;
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  let projectId = `proj-${fetcherId}-${randomSuffix}`;

  // STEP 1 — STRICT REAL DATA ACQUISITION (NO MOCK DATA)
  if (fetcherId === "web") {
    const rawUrl = inputs.url?.trim();
    if (!rawUrl) {
      throw new Error("L'URL de l'article est obligatoire pour l'importation web.");
    }
    try {
      const parsedUrl = new URL(rawUrl);
      if (!parsedUrl.protocol.startsWith("http")) {
        throw new Error("Protocole web non supporté. L'adresse doit débuter par http:// ou https://.");
      }
    } catch (e: any) {
      throw new Error(`Format d'URL web invalide : ${e.message || rawUrl}`);
    }

    const scraped = await scrapeRealArticle(rawUrl);
    title = scraped.title || "Actualité Web";
    content = scraped.content;
    articleImage = scraped.image;
    publisher = scraped.publisher || new URL(rawUrl).hostname.replace(/^www\./, "");
    author = scraped.author;
    pubdate = scraped.pubdate || pubdate;
    sourceUrl = scraped.url || rawUrl;
    byline = author ? `${author} / ${publisher}` : `Rédaction Web / ${publisher}`;

    const pathnameParts = new URL(rawUrl).pathname.split("/").filter(Boolean);
    const slug = pathnameParts[pathnameParts.length - 1] || "article";
    projectId = `web-${slug.slice(0, 30).replace(/[^a-zA-Z0-9-]/g, "") || randomSuffix}`;
  } else if (fetcherId === "rss") {
    const rssUrl = inputs.rss_url?.trim();
    if (!rssUrl) {
      throw new Error("L'adresse URL du flux RSS est requise.");
    }
    try {
      const parsed = new URL(rssUrl);
      if (!parsed.protocol.startsWith("http")) {
        throw new Error("L'adresse du flux RSS doit commencer par http:// ou https://.");
      }
    } catch {
      throw new Error("Format d'URL du flux RSS invalide.");
    }

    const rssData = await fetchRealRss(rssUrl);
    const topItem = rssData.items[0];

    title = topItem.title || "Actualité du flux RSS";
    sourceUrl = topItem.link || rssUrl;
    pubdate = topItem.pubDate || pubdate;
    author = topItem.author;
    publisher = rssData.title || new URL(rssUrl).hostname.replace(/^www\./, "");
    articleImage = topItem.image;

    // Use RSS item content or snippet
    let itemContent = topItem.content || topItem.contentSnippet || "";

    // If item content is short and a direct article link is available, scrape the full text
    if (topItem.link && itemContent.length < 200) {
      try {
        const fullArticle = await scrapeRealArticle(topItem.link);
        if (fullArticle.content && fullArticle.content.length > itemContent.length) {
          itemContent = fullArticle.content;
          if (fullArticle.image && !articleImage) articleImage = fullArticle.image;
          if (fullArticle.author && !author) author = fullArticle.author;
          if (fullArticle.title) title = fullArticle.title;
        }
      } catch {
        // Fall back to original RSS item text if scrape failed
      }
    }

    if (!itemContent || itemContent.trim().length < 40) {
      throw new Error(
        `Le flux RSS a renvoyé l'article "${title}", mais son contenu textuel est vide ou insuffisant pour générer un sujet.`
      );
    }

    content = itemContent;
    byline = author ? `${author} / ${publisher}` : `Flux RSS / ${publisher}`;
    projectId = `rss-${publisher.slice(0, 20).replace(/[^a-zA-Z0-9-]/g, "")}-${randomSuffix}`;
  } else if (fetcherId === "reuters") {
    const ref = inputs.story_id?.trim();
    if (!ref) {
      throw new Error("L'URL, mot-clé ou identifiant de dépêche Reuters est requis.");
    }

    if (ref.startsWith("http://") || ref.startsWith("https://")) {
      const scraped = await scrapeRealArticle(ref);
      title = scraped.title || `Dépêche Reuters : ${ref}`;
      content = scraped.content;
      articleImage = scraped.image;
      publisher = "Reuters News Agency";
      author = scraped.author || "Bureau Reuters";
      sourceUrl = ref;
      pubdate = scraped.pubdate || pubdate;
      byline = author ? `${author} / Reuters` : "Fil d'Agence Reuters";
      projectId = `reuters-${(inputs.project_id || randomSuffix).toString().replace(/[^a-zA-Z0-9-]/g, "")}`;
    } else {
      // Query Google News RSS for real Reuters articles matching the keyword
      const searchRssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(ref + " site:reuters.com")}&hl=fr&gl=FR&ceid=FR:fr`;
      let rssResult;
      try {
        rssResult = await fetchRealRss(searchRssUrl);
      } catch {
        // Fallback to international Reuters topic query
        const fallbackRss = `https://news.google.com/rss/search?q=${encodeURIComponent("Reuters " + ref)}&hl=en-US&gl=US&ceid=US:en`;
        rssResult = await fetchRealRss(fallbackRss);
      }

      if (!rssResult.items || rssResult.items.length === 0) {
        throw new Error(`Aucune dépêche réelle Reuters trouvée pour la recherche : "${ref}".`);
      }

      const topItem = rssResult.items[0];
      title = topItem.title;
      sourceUrl = topItem.link;
      pubdate = topItem.pubDate || pubdate;
      publisher = "Reuters News Agency";
      author = topItem.author || "Correspondants Reuters";
      byline = "Fil d'Agence Reuters";
      articleImage = topItem.image;

      let extracted = topItem.content || topItem.contentSnippet || "";
      if (topItem.link) {
        try {
          const scraped = await scrapeRealArticle(topItem.link);
          if (scraped.content && scraped.content.length > extracted.length) {
            extracted = scraped.content;
            if (scraped.image) articleImage = scraped.image;
            if (scraped.title) title = scraped.title;
          }
        } catch {
          // Use RSS snippet if direct scrape blocked
        }
      }

      if (!extracted || extracted.length < 40) {
        throw new Error(
          `La dépêche Reuters trouvée ("${title}") ne contient aucun texte suffisant pour générer un script d'actualité.`
        );
      }

      content = extracted;
      projectId = `reuters-${ref.replace(/[^a-zA-Z0-9-]/g, "") || randomSuffix}`;
    }
  } else if (fetcherId === "ap") {
    const rawRef = inputs.article_url?.trim();
    if (!rawRef) {
      throw new Error("L'URL ou l'identifiant de la dépêche AP est requise.");
    }

    const targetUrl = rawRef.startsWith("http") ? rawRef : `https://apnews.com/article/${rawRef}`;
    const scraped = await scrapeRealArticle(targetUrl);

    title = scraped.title || "Associated Press : Dépêche d'actualité";
    content = scraped.content;
    articleImage = scraped.image;
    publisher = "Associated Press (AP)";
    author = scraped.author || "Bureau AP";
    sourceUrl = targetUrl;
    pubdate = scraped.pubdate || pubdate;
    byline = author ? `${author} / AP` : "Correspondants Bureau AP";
    projectId = `ap-${(inputs.project_id || "alerte").replace(/[^a-zA-Z0-9-]/g, "")}-${randomSuffix}`;
  } else if (fetcherId === "manual") {
    const manualTitle = inputs.title?.trim();
    const manualBody = inputs.body?.trim();
    if (!manualTitle || manualTitle.length < 3) {
      throw new Error("Le titre de l'article est requis et doit être explicite.");
    }
    if (!manualBody || manualBody.length < 20) {
      throw new Error(
        "Le corps de l'article est trop court (minimum 20 caractères). Veuillez insérer un texte d'actualité complet."
      );
    }
    title = manualTitle;
    content = manualBody;
    byline = "Rédaction AI News Studio";
    publisher = "Saisie directe rédaction";
    projectId = `sujet-${Date.now().toString(36)}`;
  } else {
    throw new Error(`Source d'importation inconnue ou non prise en charge : ${fetcherId}`);
  }

  if (!content || content.trim().length < 30) {
    throw new Error(
      "Impossible de poursuivre : le contenu textuel extrait de la source est vide. Aucune donnée fictive autorisée."
    );
  }

  const sourceArticle: ArticleSourceData = {
    title,
    publisher,
    author,
    pubdate,
    url: sourceUrl,
    content,
    importedAt: new Date().toISOString(),
    fetcherId,
  };

  // Step 4 — two-stage editorial generation. The writer only receives the
  // extracted facts, never the article body.
  const durationOption = options.durationOption || "standard";
  const duration = DURATION_PRESETS[durationOption];
  const isSensitive = isSensitiveTopic(`${title} ${content}`);
  options.onProgress?.("Extraction des faits");
  const facts = await extractFactsWithOllama(content);
  const sectionDefinitions = [
    ["accroche", "Accroche"],
    ["contexte", "Contexte"],
    ["faits_cles", "Faits clés"],
    ["impact", "Impact"],
    ["suite", "Suite"],
  ] as const;
  const sectionLines: string[] = [];
  for (const [key, label] of sectionDefinitions) {
    options.onProgress?.(`Rédaction : ${label.toLowerCase()}`);
    const lines = await generateSectionWithOllama(key, label, facts, duration.sectionsBudget[key], isSensitive);
    sectionLines.push(...lines);
  }
  const sentences = sectionLines;

  // STEP 3 — REAL LEGAL MEDIA ACQUISITION (PEXELS API)
  let pexelsMediaList: (MediaResult | null)[] = [];
  try {
    pexelsMediaList = await fetchMediaCollectionForSegments(title, sentences);
  } catch (mediaErr) {
    console.warn("[ArticleGenerator] Pexels media collection failed:", mediaErr);
  }

  const moodsList: Mood[] = ["neutral", "dramatic", "hopeful", "upbeat"];
  const cameraMovementsList: CameraMovement[] = [
    "zoom-in",
    "pan-right",
    "zoom-out",
    "pan-left",
  ];
  const stylesList: TextPlacement[] = ["bottom", "middle", "bottom", "top"];

  let currentTime = 0;
  const segments: SegmentType[] = sentences.map((sentence, index) => {
    const wordCount = sentence.split(/\s+/).length;
    const duration = Math.max(3.2, Math.min(6.5, wordCount * 0.42));
    const start = currentTime;
    const end = Math.round((currentTime + duration) * 10) / 10;
    currentTime = end;

    let mainMedia: MediaAssetType;

    // Use real extracted image for the first segment if available
    if (index === 0 && articleImage) {
      mainMedia = {
        type: "image",
        url: articleImage,
        byline: publisher ? `Photo : ${publisher}` : "Illustration source de l'article",
        description: title,
        imageAsset: {
          id: `img-scraped-${Date.now()}`,
          size: { width: 1200, height: 800 },
        },
        hotspot: {
          x: 200,
          y: 100,
          width: 800,
          height: 600,
          x_norm: 0.16,
          y_norm: 0.12,
          width_norm: 0.66,
          height_norm: 0.75,
        },
      };
    } else {
      // Use Pexels legal media item
      const pexelsItem = pexelsMediaList[index] || pexelsMediaList[0];
      if (pexelsItem && pexelsItem.url) {
        if (pexelsItem.type === "video") {
          mainMedia = {
            type: "video",
            url: pexelsItem.url,
            byline: pexelsItem.attribution,
            description: title,
            startFrom: 0,
            endAt: duration,
            videoAsset: {
              id: `video-pexels-${index}-${Date.now()}`,
              title: `${title} - B-roll ${index + 1}`,
              duration: pexelsItem.duration || 15,
              streamUrls: {
                mp4: pexelsItem.url,
              },
            },
          };
        } else {
          mainMedia = {
            type: "image",
            url: pexelsItem.url,
            byline: pexelsItem.attribution,
            description: title,
            imageAsset: {
              id: `img-pexels-${index}-${Date.now()}`,
              size: { width: pexelsItem.width || 1080, height: pexelsItem.height || 1920 },
            },
          };
        }
      } else {
        // Fallback: No random photos. Clean solid editorial background card.
        mainMedia = {
          type: "image",
          url: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'><rect width='100%' height='100%' fill='%230f172a'/></svg>",
          byline: "Rédaction AI News Studio",
          description: title,
          imageAsset: {
            id: `img-fallback-${index}`,
            size: { width: 1080, height: 1920 },
          },
        };
      }
    }

    return {
      id: index + 1,
      type: "segment",
      mood: moodsList[index % moodsList.length],
      style: stylesList[index % stylesList.length],
      cameraMovement: cameraMovementsList[index % cameraMovementsList.length],
      text: sentence,
      texts: [
        {
          type: "text",
          line_id: index + 1,
          text: sentence,
          who: "default",
          start,
          end,
          displayText: sentence,
        },
      ],
      mainMedia,
      images: [mainMedia],
      start,
      end,
    };
  });

  const manuscript: ManuscriptType = {
    meta: {
      title,
      pubdate: new Date().toISOString(),
      byline,
      articleUrl: projectId,
      uniqueId: `tab-${projectId}-${Date.now()}`,
      durationOption,
      isSensitive,
      sources: sourceUrl ? [{ name: publisher || "Source originale", url: sourceUrl }] : [],
      audio: {
        src: "/assets/voice-sample.wav",
      },
    },
    segments,
    media: segments.map((s) => s.mainMedia!).filter(Boolean),
  };

  return {
    projectId,
    manuscript,
    sourceArticle,
  };
}
