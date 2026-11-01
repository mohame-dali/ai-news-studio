import { create } from "zustand";
import { Config, EditorialStatus, ManuscriptType, ProcessedManuscript, ProjectOption, Tab } from "@/types";
import { buildDefaultConfig } from "@/lib/constants";
import { sampleNewsStories } from "@/lib/sampleStories";

export type { Tab, EditorialStatus };

export interface GlobalStoreState {
  config: { projectId: string; config: Config };
  setConfig: (config: { projectId: string; config: Config }) => void;
  tabs: Tab[];
  setTabs: (tabs: Tab[]) => void;
  currentTabIndex: number;
  setCurrentTabIndex: (index: number) => void;
  currentTab?: Tab;
  customPrompt: string;
  setCustomPrompt: (prompt: string) => void;
  processedManuscripts: ProcessedManuscript[];
  setProcessedManuscripts: (manuscripts: ProcessedManuscript[]) => void;
  generationId: string;
  setGenerationId: (id: string) => void;
  selectedProject?: ProjectOption;
  setSelectedProject: (project?: ProjectOption) => void;
}

const initialStory = sampleNewsStories["arctic-climate-summit"];
const initialDefaultConfig = buildDefaultConfig("arctic-climate-summit");

export const useGlobalState = create<GlobalStoreState>((set, get) => ({
  config: {
    projectId: "arctic-climate-summit",
    config: initialDefaultConfig,
  },
  setConfig: (config) => set({ config }),
  tabs: [
    {
      articleUrl: "arctic-climate-summit",
      projectId: "arctic-climate-summit",
      manuscript: initialStory,
    },
  ],
  setTabs: (tabs) => {
    const currentIndex = get().currentTabIndex || 0;
    set({
      tabs,
      currentTab: tabs[currentIndex] || tabs[0],
    });
  },
  currentTabIndex: 0,
  setCurrentTabIndex: (currentTabIndex) => {
    const tabs = get().tabs;
    set({
      currentTabIndex,
      currentTab: tabs[currentTabIndex],
    });
  },
  customPrompt: "",
  setCustomPrompt: (customPrompt) => set({ customPrompt }),
  processedManuscripts: [],
  setProcessedManuscripts: (processedManuscripts) => set({ processedManuscripts }),
  generationId: "arctic-climate-summit",
  setGenerationId: (generationId) => set({ generationId }),
  selectedProject: {
    id: "arctic-climate-summit",
    name: "Station Arctique du Spitzberg (Climat)",
  },
  setSelectedProject: (selectedProject) => set({ selectedProject }),
}));
