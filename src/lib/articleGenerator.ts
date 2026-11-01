import { ArticleSourceData, CameraMovement, Config, ManuscriptType, MediaAssetType, Mood, SegmentType, TextPlacement } from "@/types";

const stockPhotos = [
  {
    url: "https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=1200&q=80",
    byline: "AFP / Photothèque d'actualité",
    description: "Salle de presse et conférence officielle des représentants d'État",
  },
  {
    url: "https://images.unsplash.com/photo-1504711434969-e33886168f5c?auto=format&fit=crop&w=1200&q=80",
    byline: "Agence France-Presse / Rédaction",
    description: "Écrans de contrôle et régie de diffusion d'information en continu",
  },
  {
    url: "https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?auto=format&fit=crop&w=1200&q=80",
    byline: "Archives Photographiques de Reportage",
    description: "Station scientifique de haute altitude sous lumière rasante",
  },
  {
    url: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80",
    byline: "Observatoire des Sciences & de l'Espace",
    description: "Vue satellite de la topographie planétaire et quadrillage orbital",
  },
];

const stockVideos = [
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
    title: "Séquence d'investigation sur le terrain",
    byline: "Unité de Reportage Audiovisuel",
    duration: 15,
  },
  {
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    title: "Documentaire environnemental",
    byline: "Observatoire de la Faune & Espaces Naturels",
    duration: 60,
  },
];

export async function generateManuscriptFromInput(
  fetcherId: string,
  inputs: Record<string, string>,
  config: Config
): Promise<{ projectId: string; manuscript: ManuscriptType; sourceArticle?: ArticleSourceData }> {
  // Simulation de latence réseau
  await new Promise((res) => setTimeout(res, 500));

  let title = "Flash Information : Développements Majeurs";
  let byline = "Rédaction AI News Studio";
  let content = "";
  let publisher: string | undefined = undefined;
  let author: string | undefined = undefined;
  let sourceUrl: string | undefined = undefined;
  const pubdate = new Date().toISOString();
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  let projectId = `proj-${fetcherId}-${randomSuffix}`;

  if (fetcherId === "web") {
    const rawUrl = inputs.url?.trim();
    if (!rawUrl) {
      throw new Error("L'URL de l'article est obligatoire pour l'importation web.");
    }
    try {
      const parsedUrl = new URL(rawUrl);
      if (!parsedUrl.protocol.startsWith("http")) {
        throw new Error("Protocole web non supporté.");
      }
      sourceUrl = rawUrl;
      publisher = parsedUrl.hostname.replace(/^www\./, "");
      const pathnameParts = parsedUrl.pathname.split("/").filter(Boolean);
      const slug = pathnameParts[pathnameParts.length - 1] || "article-de-presse";
      projectId = `web-${slug.replace(/[^a-zA-Z0-9-]/g, "") || randomSuffix}`;
      title = slug
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase());
    } catch {
      throw new Error("Impossible d'extraire l'article : URL web invalide ou inaccessible.");
    }
    content =
      "Les autorités ont publié un communiqué officiel précisant les orientations stratégiques aujourd'hui. Les analystes soulignent des retombées immédiates sur l'ensemble des secteurs concernés. Une concertation interministérielle est d'ores et déjà programmée pour encadrer ces dispositions.";
    byline = `Rédaction Web / ${publisher}`;
  } else if (fetcherId === "rss") {
    const rssUrl = inputs.rss_url?.trim();
    if (!rssUrl) {
      throw new Error("L'adresse URL du flux RSS est requise.");
    }
    try {
      const parsed = new URL(rssUrl);
      publisher = parsed.hostname.replace(/^www\./, "");
      sourceUrl = rssUrl;
      projectId = `rss-${publisher.replace(/[^a-zA-Z0-9-]/g, "")}-${randomSuffix}`;
    } catch {
      throw new Error("Format du flux RSS invalide. Vérifiez l'adresse web renseignée.");
    }
    title = "Actualité Récente : Synthèse du Flux RSS";
    byline = `Flux RSS / ${publisher}`;
    content =
      "Le dernier bulletin d'information signale une évolution déterminante des négociations en cours. Les équipes régionales confirment la mise en sécurité des secteurs clés et l'application des protocoles validés. Les observateurs attendent de nouvelles précisions dans le courant de l'après-midi.";
  } else if (fetcherId === "reuters") {
    const keyword = inputs.story_id?.trim();
    if (!keyword) {
      throw new Error("La référence ou le mot-clé de la dépêche Reuters est requis.");
    }
    title = `Dépêche Reuters : ${keyword.toUpperCase()}`;
    byline = "Fil d'Agence Reuters / France";
    publisher = "Reuters News Agency";
    author = "Bureau des Dépêches Internationales";
    projectId = `reuters-${(inputs.project_id || keyword).replace(/[^a-zA-Z0-9-]/g, "")}`;
    content =
      "Les délégués réunis ce matin ont finalisé un accord de coopération bilatérale. Les mesures adoptées garantissent la sécurité des échanges et la supervision réglementaire. Les marchés financiers ont réagi positivement à la publication des conclusions.";
  } else if (fetcherId === "ap") {
    const rawUrl = inputs.article_url?.trim();
    if (!rawUrl) {
      throw new Error("La référence ou l'adresse de la dépêche AP est requise.");
    }
    title = `Associated Press : Éléments Clés du Dossier`;
    byline = "Correspondants Bureau AP";
    publisher = "Associated Press (AP)";
    sourceUrl = rawUrl.startsWith("http") ? rawUrl : `https://apnews.com/article/${rawUrl}`;
    projectId = `ap-${(inputs.project_id || "alerte").replace(/[^a-zA-Z0-9-]/g, "")}`;
    content =
      "Des mesures d'urgence ont été mises en œuvre par les services municipaux coordonnés. Les inspecteurs techniques confirment la sécurisation intégrale des infrastructures de réseau. Un point de situation complet sera présenté lors de la conférence de presse d'après-midi.";
  } else if (fetcherId === "manual") {
    const manualTitle = inputs.title?.trim();
    const manualBody = inputs.body?.trim();
    if (!manualTitle || manualTitle.length < 3) {
      throw new Error("Le titre de l'article est requis et doit être explicite.");
    }
    if (!manualBody || manualBody.length < 15) {
      throw new Error("Le corps de l'article est trop court. Veuillez insérer un texte d'actualité complet.");
    }
    title = manualTitle;
    content = manualBody;
    byline = "Rédaction AI News Studio";
    publisher = "Saisie directe rédaction";
    projectId = `sujet-${Date.now().toString(36)}`;
  } else {
    throw new Error(`Source d'importation inconnue ou non prise en charge : ${fetcherId}`);
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

  // Découpage en phrases du contenu
  const rawSentences = content
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);

  const sentences =
    rawSentences.length > 0
      ? rawSentences.slice(0, 4)
      : [
          "Les autorités régionales ont déployé des mesures d'urgence ce matin.",
          "Les équipes d'experts confirment la stabilité des réseaux techniques essentiels.",
          "Les représentants officiels annoncent un protocole de suivi dans l'après-midi.",
        ];

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
    if (index === 0) {
      const photo = stockPhotos[index % stockPhotos.length];
      mainMedia = {
        type: "image",
        url: photo.url,
        byline: photo.byline,
        description: photo.description,
        imageAsset: {
          id: `img-${index}-${Date.now()}`,
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
    } else if (index === 1) {
      if (index % 2 === 1) {
        const video = stockVideos[0];
        mainMedia = {
          type: "video",
          url: video.url,
          byline: video.byline,
          description: video.title,
          startFrom: 2,
          endAt: 7,
          videoAsset: {
            id: `video-${index}`,
            title: video.title,
            duration: video.duration,
            streamUrls: {
              mp4: video.url,
            },
          },
        };
      } else {
        mainMedia = {
          type: "map",
          byline: "Cartographie IGN / OpenStreetMap",
          location: {
            lat: 48.8566,
            lon: 2.3522,
            zoomStart: 6,
            zoomEnd: 8,
          },
        };
      }
    } else {
      const photo = stockPhotos[(index + 1) % stockPhotos.length];
      mainMedia = {
        type: "image",
        url: photo.url,
        byline: photo.byline,
        description: photo.description,
        imageAsset: {
          id: `img-${index}-${Date.now()}`,
          size: { width: 1200, height: 800 },
        },
      };
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
