import { z } from "zod";

export const cameraMovementsEnum = z.enum([
  "none",
  "pan-left",
  "pan-right",
  "pan-up",
  "pan-down",
  "zoom-in",
  "zoom-out",
  "zoom-rotate-left",
  "zoom-rotate-right",
  "zoom-out-rotate-left",
  "zoom-out-rotate-right",
]);

export type CameraMovement = z.infer<typeof cameraMovementsEnum>;

export const moodEnum = z.enum([
  "mellow",
  "sad",
  "dramatic",
  "neutral",
  "hopeful",
  "upbeat",
]);

export type Mood = z.infer<typeof moodEnum>;

export const textPlacementEnum = z.enum(["top", "middle", "bottom"]);
export type TextPlacement = z.infer<typeof textPlacementEnum>;

export const locationSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  stillTime: z.number().optional(),
  zoomStart: z.number().optional(),
  zoomEnd: z.number().optional(),
  rotation: z.number().optional(),
});

export type LocationType = z.infer<typeof locationSchema>;

export const videoAssetSchema = z.object({
  id: z.string(),
  assetType: z.enum(["audio", "video"]).optional(),
  displays: z.number().optional(),
  duration: z.number().optional(),
  title: z.string(),
  streamUrls: z.object({
    hls: z.string().url().nullable().optional(),
    hds: z.string().url().nullable().optional(),
    mp4: z.string().url().nullable().optional(),
    pseudostreaming: z.array(z.string().url()).optional().nullable(),
  }),
});

export type VideoAssetType = z.infer<typeof videoAssetSchema>;

export const hotspotSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  x_norm: z.number().optional(),
  y_norm: z.number().optional(),
  width_norm: z.number().optional(),
  height_norm: z.number().optional(),
});

export type HotspotType = z.infer<typeof hotspotSchema>;

export const sizeSchema = z.object({
  width: z.number(),
  height: z.number(),
});

export const imageAssetSchema = z.object({
  id: z.string(),
  size: sizeSchema,
});

export const blurRegionSchema = z.object({
  x: z.number(), // normalized 0..1 (relative to image/video width)
  y: z.number(), // normalized 0..1 (relative to image/video height)
  w: z.number(), // normalized 0..1
  h: z.number(), // normalized 0..1
});

export type BlurRegion = z.infer<typeof blurRegionSchema>;

export const imageSchema = z.object({
  type: z.literal("image"),
  byline: z.string().optional(),
  author: z.string().optional(),
  description: z.string().optional(),
  imageAsset: imageAssetSchema,
  url: z.string(),
  hotspot: hotspotSchema.optional(),
  license: z.string().optional(),
  licenseUrl: z.string().optional(),
  licenseValidated: z.boolean().optional(),
  source: z.string().optional(),
  blurRegions: z.array(blurRegionSchema).optional(),
});

export type ImageType = z.infer<typeof imageSchema>;

export const videoSchema = z.object({
  type: z.literal("video"),
  changedId: z.string().optional(),
  description: z.string().optional(),
  videoAsset: videoAssetSchema,
  startFrom: z.number().optional(),
  endAt: z.number().optional(),
  byline: z.string().optional(),
  author: z.string().optional(),
  url: z.string(),
  license: z.string().optional(),
  licenseUrl: z.string().optional(),
  licenseValidated: z.boolean().optional(),
  source: z.string().optional(),
  blurRegions: z.array(blurRegionSchema).optional(),
});

export type VideoType = z.infer<typeof videoSchema>;

export const mapSchema = z.object({
  type: z.literal("map"),
  location: locationSchema,
  byline: z.string().optional(),
  author: z.string().optional(),
  license: z.string().optional(),
  licenseUrl: z.string().optional(),
  licenseValidated: z.boolean().optional(),
  source: z.string().optional(),
  blurRegions: z.array(blurRegionSchema).optional(),
});

export type MapType = z.infer<typeof mapSchema>;

export const textSchema = z.object({
  type: z.string(),
  text: z.string(),
  line_id: z.number(),
  who: z.string().optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  displayText: z.string().optional(),
});

export type TextType = z.infer<typeof textSchema>;

export const mediaAssetSchema = z.union([imageSchema, videoSchema, mapSchema]);
export type MediaAssetType = z.infer<typeof mediaAssetSchema>;

export const graphicModeEnum = z.enum(["none", "auto", "number", "quote", "map"]);
export type GraphicMode = z.infer<typeof graphicModeEnum>;

export const segmentSchema = z.object({
  id: z.union([z.number(), z.string()]),
  mood: moodEnum,
  type: z.string(),
  style: textPlacementEnum,
  text: z.string().optional(),
  texts: z.array(textSchema),
  cameraMovement: cameraMovementsEnum,
  images: z.array(mediaAssetSchema).optional(),
  mainMedia: mediaAssetSchema.optional(),
  customAudio: z
    .object({
      src: z.string().optional(),
      length: z.number().optional(),
    })
    .optional(),
  start: z.number().optional(),
  end: z.number().optional(),
  licenseValidated: z.boolean().optional(),
  graphicMode: graphicModeEnum.optional(),
  blurRegions: z.array(blurRegionSchema).optional(),
});

export type SegmentType = z.infer<typeof segmentSchema>;

export const manuscriptSchema = z.object({
  meta: z.object({
    title: z.string(),
    pubdate: z.string(),
    byline: z.string(),
    articleUrl: z.string().optional(),
    uniqueId: z.string().optional(),
    uniquId: z.string().optional(),
    durationOption: z.enum(["court", "standard", "long"]).optional(),
    isSensitive: z.boolean().optional(),
    sources: z.array(z.object({ name: z.string(), url: z.string().optional() })).optional(),
    prompt: z.array(z.any()).optional(),
    generatedSegments: z.array(segmentSchema).optional(),
    description: z.string().optional(),
    audio: z
      .object({
        src: z.string().optional(),
      })
      .optional(),
  }),
  segments: z.array(segmentSchema),
  media: z.array(mediaAssetSchema).optional(),
  uniqueId: z.string().optional(),
  uniquId: z.string().optional(),
});

export type ManuscriptType = z.infer<typeof manuscriptSchema>;

export const processedManuscriptSchema = manuscriptSchema;
export type ProcessedManuscript = z.infer<typeof processedManuscriptSchema>;

export const customCutsSchema = z.object({
  portrait: z.string(),
  landscape: z.string(),
  duration: z.number(),
  offset: z.number(),
});

export const reporterVideoSchema = z.object({
  portrait: z.string(),
  landscape: z.string(),
  duration: z.number(),
  selected: z.boolean().optional(),
});

export const colorsSchema = z.object({
  text: z.object({
    text: z.string(),
    background: z.string(),
  }),
  progress: z.object({
    active: z.object({
      background: z.string(),
      text: z.string(),
    }),
    inactive: z.object({
      background: z.string(),
      text: z.string(),
    }),
  }),
  map: z.object({
    marker: z.string(),
  }),
  fotoCredits: z.object({
    text: z.string(),
    icon: z.string(),
  }),
});

export const playerSchema = z.object({
  assetBaseUrl: z.string().optional(),
  logo: z.string().optional(),
  logoStyle: z.string().optional(),
  defaultCameraMovements: z.array(cameraMovementsEnum).optional(),
  fonts: z.record(z.string(), z.string()).optional(),
  colors: colorsSchema.optional(),
  backgroundMusicVolume: z.number().optional(),
  backgroundMusic: z.string().optional(),
  intro: customCutsSchema.optional(),
  wipe: customCutsSchema.optional(),
  outro: customCutsSchema.optional(),
  reporterVideos: z
    .object({
      intro: z.record(z.string(), reporterVideoSchema).optional(),
      outro: z.record(z.string(), reporterVideoSchema).optional(),
    })
    .optional(),
});

export type PlayerConfig = z.infer<typeof playerSchema>;

export const appConfigSchema = z.object({
  name: z.string(),
  description: z.string(),
  id: z.string(),
  people: z.object({
    default: z.object({
      voice: z.string(),
      stability: z.number(),
      similarity_boost: z.number(),
      style: z.number(),
      use_speaker_boost: z.boolean(),
    }),
  }),
  manuscript: z.object({
    split_article_into_chapters: z.boolean(),
    intro: z.string().optional(),
    outro: z.string().optional(),
    script_prompt: z.string(),
    placement_prompt: z.string(),
    describe_images_prompt: z.string(),
  }),
  graphics: z.object({
    item_types: z.array(z.string()),
  }),
  audio: z.object({
    tts: z.string(),
    background: z.object({
      max_volume: z.number(),
      min_volume: z.number(),
      music: z.record(z.string(), z.any()).optional(),
    }),
    sync_silence: z.number(),
    segment_pause: z.number(),
    segment_pause_silence: z.number(),
  }),
  player: playerSchema.optional(),
  exportDefaults: z
    .object({
      exportType: z.string().optional(),
      logo: z.boolean().optional(),
      audio: z.boolean().optional(),
      voice: z.boolean().optional(),
      music: z.boolean().optional(),
    })
    .optional(),
  default_assets_base_url: z.string().optional(),
});

export type Config = z.infer<typeof appConfigSchema>;

export type FetcherField = {
  name: string;
  label: string;
  required: boolean;
  placeholder?: string;
};

export type FetcherOption = {
  id: string;
  title: string;
  description: string;
  fields: FetcherField[];
};

export type BrandOption = {
  id: string;
  brandName: string;
  scriptPrompt: string;
  placementPrompt?: string;
  describeImagesPrompt?: string;
  config?: Partial<Config>;
};

export interface ArticleSourceData {
  title: string;
  publisher?: string;
  author?: string;
  pubdate?: string;
  url?: string;
  content: string;
  importedAt: string;
  fetcherId: string;
}

export type EditorialStatus =
  | "imported"
  | "script_generated"
  | "under_review"
  | "corrections_required"
  | "approved";

export interface EditorialRevision {
  timestamp: string;
  status: EditorialStatus;
  note?: string;
  author?: string;
  snapshotTexts?: string[];
}

export type DurationOption = "court" | "standard" | "long";

export interface NewsGroupItem {
  id: string;
  title: string;
  link: string;
  source: string;
  sourceId: string;
  pubDate: string;
  region: "france" | "europe" | "monde";
  relatedSources: string[];
  sourceCount: number;
}

export interface RankedNewsItem extends NewsGroupItem {
  score: number;
  category: "france" | "europe" | "monde";
  reason: string;
  isAiRanked: boolean;
}

export type Tab = {
  articleUrl: string;
  manuscript: ManuscriptType;
  projectId?: string;
  backendGenerationId?: string;
  originalArticle?: ArticleSourceData;
  editorialStatus?: EditorialStatus;
  revisions?: EditorialRevision[];
  originalScriptSnapshot?: string[];
  approvedScriptSnapshot?: string[]; // Snapshot of script when approved, for comparison
  durationOption?: DurationOption;
  isSensitive?: boolean;
  sources?: Array<{ name: string; url?: string }>;
};

export type ProjectOption = {
  id: string;
  name: string;
};

