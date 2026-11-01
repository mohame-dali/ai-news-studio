import { ArticleSourceData, Config, EditorialStatus, ManuscriptType, Tab } from "@/types";
import { buildDefaultConfig, defaultBrands } from "./constants";
import { sampleNewsStories, sampleSourceArticles } from "./sampleStories";

export type GenerationRecord = {
  id: string;
  projectId: string;
  brandId: string;
  config: Config;
  data: Tab[];
  project: {
    id: string;
    name: string;
  };
  createdDate: string;
  updatedAt: string;
  editorialStatus?: EditorialStatus;
  originalArticle?: ArticleSourceData;
};

const STORAGE_KEY_GENERATIONS = "videofy_generations";
const STORAGE_KEY_PROJECTS = "videofy_projects";

export function initializeStorage(): void {
  try {
    const existingGenerations = localStorage.getItem(STORAGE_KEY_GENERATIONS);
    if (!existingGenerations) {
      const defaultStory = sampleNewsStories["arctic-climate-summit"];
      const defaultSource = sampleSourceArticles["arctic-climate-summit"];
      const defaultBrand = defaultBrands[0];
      const defaultConfig = buildDefaultConfig("arctic-climate-summit");
      if (defaultBrand.config?.player) {
        defaultConfig.player = {
          ...defaultConfig.player,
          ...defaultBrand.config.player,
        };
      }

      const initialRecord: GenerationRecord = {
        id: "arctic-climate-summit",
        projectId: "arctic-climate-summit",
        brandId: defaultBrand.id,
        config: defaultConfig,
        editorialStatus: "under_review",
        originalArticle: defaultSource,
        project: {
          id: "arctic-climate-summit",
          name: "Station Arctique du Spitzberg (Climat)",
        },
        data: [
          {
            articleUrl: "arctic-climate-summit",
            projectId: "arctic-climate-summit",
            manuscript: defaultStory,
            editorialStatus: "under_review",
            originalArticle: defaultSource,
            originalScriptSnapshot: defaultStory.segments.map((s) => s.text || ""),
          },
        ],
        createdDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      localStorage.setItem(
        STORAGE_KEY_GENERATIONS,
        JSON.stringify({ "arctic-climate-summit": initialRecord })
      );

      localStorage.setItem(
        STORAGE_KEY_PROJECTS,
        JSON.stringify([
          { id: "arctic-climate-summit", name: "Station Arctique du Spitzberg (Climat)" },
          { id: "mars-water-discovery", name: "Mission Martienne — Eau Liquide" },
        ])
      );
    }
  } catch (err) {
    console.warn("LocalStorage access error:", err);
  }
}

export function getAllGenerations(): Record<string, GenerationRecord> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GENERATIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getGeneration(id: string): GenerationRecord | null {
  const all = getAllGenerations();
  if (all[id]) return all[id];

  // If id is in sample stories, construct it on the fly
  if (sampleNewsStories[id]) {
    const defaultStory = sampleNewsStories[id];
    const defaultSource = sampleSourceArticles[id];
    const defaultConfig = buildDefaultConfig(id);
    const record: GenerationRecord = {
      id,
      projectId: id,
      brandId: "default",
      config: defaultConfig,
      editorialStatus: "under_review",
      originalArticle: defaultSource,
      project: { id, name: defaultStory.meta.title },
      data: [
        {
          articleUrl: id,
          projectId: id,
          manuscript: defaultStory,
          editorialStatus: "under_review",
          originalArticle: defaultSource,
          originalScriptSnapshot: defaultStory.segments.map((s) => s.text || ""),
        },
      ],
      createdDate: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    saveGeneration(record);
    return record;
  }

  // Fallback to first available generation if any
  const keys = Object.keys(all);
  if (keys.length > 0) return all[keys[0]];

  return null;
}

export function saveGeneration(record: GenerationRecord): void {
  try {
    const all = getAllGenerations();
    all[record.id] = {
      ...record,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORAGE_KEY_GENERATIONS, JSON.stringify(all));

    // Also register in projects list if not present
    const projects = getProjectList();
    if (!projects.some((p) => p.id === record.projectId)) {
      projects.push(record.project);
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
    }
  } catch (err) {
    console.error("Failed to save generation to localStorage:", err);
  }
}

export function updateGenerationData(id: string, data: Tab[]): void {
  const existing = getGeneration(id);
  if (existing) {
    existing.data = data;
    if (data[0]?.editorialStatus) {
      existing.editorialStatus = data[0].editorialStatus;
    }
    if (data[0]?.originalArticle) {
      existing.originalArticle = data[0].originalArticle;
    }
    saveGeneration(existing);
  }
}

export function updateEditorialStatus(
  id: string,
  status: EditorialStatus,
  note?: string
): void {
  const existing = getGeneration(id);
  if (existing) {
    existing.editorialStatus = status;
    if (existing.data && existing.data[0]) {
      existing.data[0].editorialStatus = status;
      const revisions = existing.data[0].revisions || [];
      revisions.push({
        timestamp: new Date().toISOString(),
        status,
        note: note || `Statut passé à : ${status}`,
        snapshotTexts: existing.data[0].manuscript.segments.map((s) => s.text || ""),
      });
      existing.data[0].revisions = revisions;
    }
    saveGeneration(existing);
  }
}

export function getProjectList(): { id: string; name: string }[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return [
    { id: "arctic-climate-summit", name: "Station Arctique du Spitzberg (Climat)" },
    { id: "mars-water-discovery", name: "Mission Martienne — Eau Liquide" },
  ];
}

