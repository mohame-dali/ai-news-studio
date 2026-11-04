import { BrandOption, CameraMovement, Config, FetcherOption, Mood, TextPlacement } from "@/types";
import { fr } from "./i18n";

export const moods: { id: Mood; name: string; color: string }[] = [
  { id: "neutral", name: fr.moods.neutral, color: "#6b7280" },
  { id: "mellow", name: fr.moods.mellow, color: "#3b82f6" },
  { id: "sad", name: fr.moods.sad, color: "#6366f1" },
  { id: "dramatic", name: fr.moods.dramatic, color: "#ef4444" },
  { id: "hopeful", name: fr.moods.hopeful, color: "#10b981" },
  { id: "upbeat", name: fr.moods.upbeat, color: "#f59e0b" },
];

export const textPlacements: { id: TextPlacement; name: string }[] = [
  { id: "bottom", name: fr.placement.bottom },
  { id: "middle", name: fr.placement.middle },
  { id: "top", name: fr.placement.top },
];

export const cameraMovements: { id: CameraMovement; name: string }[] = [
  { id: "zoom-in", name: fr.camera["zoom-in"] },
  { id: "zoom-out", name: fr.camera["zoom-out"] },
  { id: "pan-left", name: fr.camera["pan-left"] },
  { id: "pan-right", name: fr.camera["pan-right"] },
  { id: "pan-up", name: fr.camera["pan-up"] },
  { id: "pan-down", name: fr.camera["pan-down"] },
  { id: "zoom-rotate-left", name: fr.camera["zoom-rotate-left"] },
  { id: "zoom-rotate-right", name: fr.camera["zoom-rotate-right"] },
  { id: "zoom-out-rotate-left", name: fr.camera["zoom-out-rotate-left"] },
  { id: "zoom-out-rotate-right", name: fr.camera["zoom-out-rotate-right"] },
  { id: "none", name: fr.camera.none },
];

export const WORDS_PER_SECOND = 2.5;

export interface DurationPreset {
  id: "court" | "standard" | "long";
  label: string;
  description: string;
  targetSeconds: number;
  wordBudget: number;
  sectionsBudget: {
    accroche: number;
    contexte: number;
    faits_cles: number;
    impact: number;
    suite: number;
  };
}

export const DURATION_PRESETS: Record<"court" | "standard" | "long", DurationPreset> = {
  court: {
    id: "court",
    label: "Court (15-30 s)",
    description: "Format dynamique ultra-court (25 s, ~60 mots)",
    targetSeconds: 25,
    wordBudget: 62,
    sectionsBudget: {
      accroche: 12,
      contexte: 12,
      faits_cles: 18,
      impact: 10,
      suite: 10,
    },
  },
  standard: {
    id: "standard",
    label: "Standard (60 s)",
    description: "Format équilibré pour réseaux sociaux (60 s, ~150 mots)",
    targetSeconds: 60,
    wordBudget: 150,
    sectionsBudget: {
      accroche: 22,
      contexte: 30,
      faits_cles: 45,
      impact: 30,
      suite: 23,
    },
  },
  long: {
    id: "long",
    label: "Long (120 s)",
    description: "Format approfondi de décryptage (120 s, ~300 mots)",
    targetSeconds: 120,
    wordBudget: 300,
    sectionsBudget: {
      accroche: 40,
      contexte: 65,
      faits_cles: 95,
      impact: 60,
      suite: 40,
    },
  },
};

export const SENSITIVE_KEYWORDS = [
  "deces", "décès", "mort", "morte", "morts", "attentat", "attentats",
  "guerre", "guerres", "massacre", "massacres", "victime", "victimes",
  "viol", "viols", "suicide", "suicides", "meurtre", "meurtres",
  "assassinat", "assassinats", "tuerie", "fusillade", "fusillades",
  "agression", "agressions", "homicide", "homicides", "drame", "otage", "otages",
  "terrorisme", "terroriste"
];

export function isSensitiveTopic(text: string): boolean {
  if (!text) return false;
  const lower = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return SENSITIVE_KEYWORDS.some((kw) => {
    const normalizedKeyword = kw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const regex = new RegExp(`(^|[^a-z0-9])${normalizedKeyword}([^a-z0-9]|$)`, "i");
    return regex.test(lower);
  });
}

export const frenchScriptPrompt = `Tu es un journaliste d'agence de presse et présentateur de flashs vidéo d'actualité pour la rédaction d'AI News Studio.

Ta mission est de synthétiser l'article de presse fourni en un script clair, rigoureux et percutant en français, adapté à une voix off pour formats vidéo verticaux (TikTok, Reels, Shorts) et horizontaux.

Consignes éditoriales strictes :
1. Langue : Français naturel, soutenu et accessible.
2. Structure : Exactement 3 ou 4 phrases courtes, chacune apportant une information factuelle nouvelle.
3. Phrase 1 (Accroche) : Énonce directement le fait majeur (qui, quoi, quand). Bannis toute formule de bienvenue ou remplissage.
4. Phrases 2 et 3 (Développement) : Expose les causes, chiffres clés, citations vérifiées et contexte essentiel.
5. Dernière phrase (Conclusion) : Présente les retombées prévues, démarches judiciaires ou perspectives.
6. Règle des 12 mots : Chaque phrase doit être concise (12 mots maximum) et formulée pour une prononciation fluide par le présentateur vocal.
7. Rigueur factuelle : Ne fabrique jamais d'information, de date, de chiffre ou de citation absente de l'article source. Ne transforme pas une hypothèse en certitude.
8. Caractères et prononciation : N'inclus aucun caractère spécial, émoji ou balise markdown parasite incompatible avec la synthèse vocale.`;

export const frenchPlacementPrompt = `Tu es réalisateur vidéo et monteur pour une rédaction d'actualités. Tu disposes d'un script numéroté en français et d'une liste de médias (vidéos, photographies d'agence, cartes géographiques) extraits de l'article.

Consignes de réalisation :
1. Associe à chaque phrase du script le média visuel qui illustre le plus fidèlement l'action, le lieu ou la personnalité évoquée.
2. Priorise systématiquement les extraits vidéos dynamiques lorsqu'ils sont disponibles.
3. Positionne un média cartographique dès qu'une localisation géographique clé est mentionnée dans le texte.
4. Assure la cohérence narrative du sujet sans réutiliser le même média deux fois, sauf si aucun autre visuel pertinent n'est disponible.
5. Veille à ce que chaque phrase dispose d'un média d'appui.`;

export const frenchDescribeImagesPrompt = `Tu es un documentaliste iconographe de presse. Pour chaque image de l'article transmise en entrée, rédige une description factuelle, concise et neutre de la scène, des sujets visibles, du contexte et de l'ambiance, sans interprétation subjective.`;

export const defaultBrandPrompt = `You are a journalist writing voice scripts for SoMe videos summarising the daily news. You will receive a news article in the user input. Lets do this step by step:
1: Read the article and understand what the article is about
2: Note the key points that are important for the reader to understand. What is new, surprising or interesting?
3: Summarize these points in a way that is factual, but also engaging and informative. Go straight to the content of the article, no welcome/padding text.
4: The script should consist of 2 to 4 punchy lines of text. Each line should give the readers new and relevant information about the article.
5: The last line should offer some form of completion or conclusion to the article. Make sure that all major perspectives are correctly represented in the script.
6: Then rewrite each line so it is a grammatically correct, punchy and engaging sentence of max 12 words. Make sure the sentence uses simple words so it is easy to read for the voice actor.
7: Do not include encodings or special characters that can not be pronounced by the voice actor.`;

export const defaultPlacementPrompt = `You are a movie director creating a short video clip from an article on a news site. The article contains videos, images and maps that can be used to create the video clip. You receive a numbered list of script lines and a numbered list of visual items (videos, maps and images) extracted from the article. Let's do this step by step:
1. Read the metadata for each item and place the items for each text line to best support the final video clip. Videos should be prioritized.
2. Always prioritize including video items if they are present in the list.
3. Pay attention to the item caption or description to try to match the person, place or activity mentioned in the text.
4. Place map items on the same line that mentions the location of the news event.
5. You do not have to use all the items, but you should use at least one item for each line in the script.
6. Do not use the same item for more than one line.`;

export const defaultDescribeImagesPrompt = `You are a helpful assistant. You are given a set of images from a news article in the user input. Describe briefly and factual what is on the image. Describe the scene, persons, mood etc. Suggest what kind of activity or event that might be happening in the image.`;

export const defaultBrands: BrandOption[] = [
  {
    id: "french-news",
    brandName: "French News (Actualités France)",
    scriptPrompt: frenchScriptPrompt,
    placementPrompt: frenchPlacementPrompt,
    describeImagesPrompt: frenchDescribeImagesPrompt,
    config: {
      player: {
        logo: "/brand_assets/vs-logo.svg",
        logoStyle: "position: absolute; top: 60px; right: 40px; width: 100px; height: auto;",
        colors: {
          text: {
            background: "#002664",
            text: "#FFFFFF",
          },
          progress: {
            active: {
              background: "#ED1C24",
              text: "#FFFFFF",
            },
            inactive: {
              background: "#1F2937",
              text: "#9CA3AF",
            },
          },
          map: {
            marker: "#ED1C24",
          },
          fotoCredits: {
            text: "#E5E7EB",
            icon: "#E5E7EB",
          },
        },
        backgroundMusicVolume: 0.35,
        backgroundMusic: "https://actions.google.com/sounds/v1/weather/rain_heavy.ogg",
      },
    },
  },
  {
    id: "default",
    brandName: "Default (Global News)",
    scriptPrompt: defaultBrandPrompt,
    placementPrompt: defaultPlacementPrompt,
    describeImagesPrompt: defaultDescribeImagesPrompt,
    config: {
      player: {
        logo: "/assets/logo.svg",
        logoStyle: "position: absolute; top: 70px; right: 45px; width: 90px; height: auto;",
        colors: {
          text: {
            background: "#2C4FE3",
            text: "#ffffff",
          },
          progress: {
            active: {
              background: "#2C4FE3",
              text: "#ffffff",
            },
            inactive: {
              background: "#1f2937",
              text: "#9ca3af",
            },
          },
          map: {
            marker: "#2C4FE3",
          },
          fotoCredits: {
            text: "#e5e7eb",
            icon: "#e5e7eb",
          },
        },
        backgroundMusic: "https://actions.google.com/sounds/v1/weather/rain_heavy.ogg",
        backgroundMusicVolume: 0.35,
      },
    },
  },
  {
    id: "nordic-news",
    brandName: "Nordic News (VG Style)",
    scriptPrompt: `You are an investigative Nordic news editor writing voice-over scripts for short-form mobile videos.
1. Capture the immediate breaking hook in the first sentence.
2. Provide concrete facts, numbers or witness quotes in the second sentence.
3. Conclude with the upcoming impact or legal/social next steps.
4. Keep sentences under 11 words and punchy.`,
    placementPrompt: defaultPlacementPrompt,
    describeImagesPrompt: defaultDescribeImagesPrompt,
    config: {
      player: {
        logo: "/brand_assets/vs-logo.svg",
        logoStyle: "position: absolute; top: 60px; right: 40px; width: 100px; height: auto;",
        colors: {
          text: {
            background: "#DC2626",
            text: "#ffffff",
          },
          progress: {
            active: {
              background: "#DC2626",
              text: "#ffffff",
            },
            inactive: {
              background: "#000000",
              text: "#ffffff",
            },
          },
          map: {
            marker: "#DC2626",
          },
          fotoCredits: {
            text: "#d1d5db",
            icon: "#d1d5db",
          },
        },
        backgroundMusicVolume: 0.4,
      },
    },
  },
  {
    id: "tech-wire",
    brandName: "TechWire Dynamic",
    scriptPrompt: `Summarize the tech and science breakthrough into 3 thrilling sentences. Highlight innovation, real-world utility, and release date or market consequence.`,
    placementPrompt: defaultPlacementPrompt,
    describeImagesPrompt: defaultDescribeImagesPrompt,
    config: {
      player: {
        logo: "/assets/logo.svg",
        logoStyle: "position: absolute; top: 60px; right: 40px; width: 85px;",
        colors: {
          text: {
            background: "#059669",
            text: "#ffffff",
          },
          progress: {
            active: {
              background: "#059669",
              text: "#ffffff",
            },
            inactive: {
              background: "#111827",
              text: "#6b7280",
            },
          },
          map: {
            marker: "#059669",
          },
          fotoCredits: {
            text: "#9ca3af",
            icon: "#9ca3af",
          },
        },
        backgroundMusicVolume: 0.3,
      },
    },
  },
];

export const defaultFetchers: FetcherOption[] = [
  {
    id: "web",
    title: fr.fetchers.web.title,
    description: fr.fetchers.web.description,
    fields: [
      {
        name: "url",
        label: "URL de l'article",
        required: true,
        placeholder: fr.fetchers.web.urlPlaceholder,
      },
      {
        name: "project_id",
        label: "Identifiant du projet (optionnel)",
        required: false,
        placeholder: "projet-actu-web",
      },
    ],
  },
  {
    id: "reuters",
    title: fr.fetchers.reuters.title,
    description: fr.fetchers.reuters.description,
    fields: [
      {
        name: "story_id",
        label: "Mot-clé ou Identifiant de dépêche",
        required: true,
        placeholder: fr.fetchers.reuters.keywordPlaceholder,
      },
      {
        name: "project_id",
        label: "Identifiant du projet (optionnel)",
        required: false,
        placeholder: "depeche-reuters-01",
      },
    ],
  },
  {
    id: "ap",
    title: fr.fetchers.ap.title,
    description: fr.fetchers.ap.description,
    fields: [
      {
        name: "article_url",
        label: "URL de la dépêche AP",
        required: true,
        placeholder: fr.fetchers.ap.urlPlaceholder,
      },
      {
        name: "project_id",
        label: "Identifiant du projet (optionnel)",
        required: false,
        placeholder: "rapport-ap-projet",
      },
    ],
  },
  {
    id: "rss",
    title: fr.fetchers.rss.title,
    description: fr.fetchers.rss.description,
    fields: [
      {
        name: "rss_url",
        label: "URL du flux RSS",
        required: true,
        placeholder: fr.fetchers.rss.urlPlaceholder,
      },
      {
        name: "project_id",
        label: "Identifiant du projet (optionnel)",
        required: false,
        placeholder: "flux-rss-actu",
      },
    ],
  },
  {
    id: "manual",
    title: fr.fetchers.manual.title,
    description: fr.fetchers.manual.description,
    fields: [
      {
        name: "title",
        label: "Titre de l'article",
        required: true,
        placeholder: fr.fetchers.manual.titlePlaceholder,
      },
      {
        name: "body",
        label: "Corps du texte de l'article",
        required: true,
        placeholder: fr.fetchers.manual.bodyPlaceholder,
      },
    ],
  },
];

export function buildDefaultConfig(projectId: string = "projet-actualites-france"): Config {
  return {
    name: "French News Studio",
    description: "Configuration éditoriale et graphique en langue française",
    id: projectId,
    people: {
      default: {
        voice: "fr-FR-standard",
        stability: 0.6,
        similarity_boost: 0.8,
        style: 0,
        use_speaker_boost: true,
      },
    },
    manuscript: {
      split_article_into_chapters: false,
      script_prompt: frenchScriptPrompt,
      placement_prompt: frenchPlacementPrompt,
      describe_images_prompt: frenchDescribeImagesPrompt,
    },
    graphics: {
      item_types: ["text", "image", "video", "map"],
    },
    audio: {
      tts: "piper",
      background: {
        max_volume: 1,
        min_volume: 0.2,
      },
      sync_silence: 0.4,
      segment_pause: 0.35,
      segment_pause_silence: 0.35,
    },
    player: {
      logo: "/brand_assets/vs-logo.svg",
      logoStyle: "position: absolute; top: 60px; right: 40px; width: 100px; height: auto;",
      colors: {
        text: {
          background: "#002664",
          text: "#FFFFFF",
        },
        progress: {
          active: {
            background: "#ED1C24",
            text: "#FFFFFF",
          },
          inactive: {
            background: "#1F2937",
            text: "#9CA3AF",
          },
        },
        map: {
          marker: "#ED1C24",
        },
        fotoCredits: {
          text: "#E5E7EB",
          icon: "#E5E7EB",
        },
      },
      backgroundMusicVolume: 0.35,
      backgroundMusic: "https://actions.google.com/sounds/v1/weather/rain_heavy.ogg",
    },
    default_assets_base_url: `/projects/${projectId}/files/input`,
    exportDefaults: {
      exportType: "Vertical",
      logo: true,
      audio: true,
      voice: true,
      music: true,
    },
  };
}
