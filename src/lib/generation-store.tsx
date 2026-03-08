import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type ModelType = "nanobanana-2" | "nanobanana-pro";

export type TaskStatus = "creating" | "generating" | "downloading" | "complete" | "error";

export interface GenerationTask {
  id: string;
  prompt: string;
  referenceImagePreviews: string[];
  referenceImageBase64: string[];
  model: ModelType;
  aspectRatio: string;
  resolution: string;
  numImages: number;
  status: TaskStatus;
  statusDetail?: string;
  generatedImages: string[];
  error?: string;
  createdAt?: number;
  completedAt?: number;
  webSearch?: boolean;
  thinkingLevel?: string;
}

const TASKS_STORAGE_KEY = "nanobanana_tasks";

function loadTasks(): GenerationTask[] {
  try {
    const raw = localStorage.getItem(TASKS_STORAGE_KEY);
    if (!raw) return [];
    const tasks = JSON.parse(raw) as GenerationTask[];
    return tasks.map((t) => ({
      ...t,
      status: (t.generatedImages && t.generatedImages.length > 0) ? "complete" : (t.status === "complete" || t.status === "error" ? t.status : "error" as TaskStatus),
      error: (t.status !== "complete" && t.status !== "error" && (!t.generatedImages || t.generatedImages.length === 0)) ? "页面刷新后任务中断" : t.error,
    }));
  } catch {
    return [];
  }
}

function saveTasks(tasks: GenerationTask[]) {
  try {
    const toSave = tasks.slice(-20).map((t) => ({
      ...t,
      // Keep Storage URLs (short), drop large base64 data URLs
      referenceImageBase64: (t.referenceImageBase64 || []).filter(img => img.startsWith("http")),
      referenceImagePreviews: (t.referenceImagePreviews || []).filter(img => img.startsWith("http")),
      generatedImages: (t.generatedImages || []).filter((img) => img.startsWith("http")),
    }));
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.warn("Failed to save tasks to localStorage:", e);
    try {
      const minimal = tasks.slice(-5).map(t => ({
        ...t,
        referenceImageBase64: [],
        referenceImagePreviews: [],
        generatedImages: [],
      }));
      localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(minimal));
    } catch {
      try { localStorage.removeItem(TASKS_STORAGE_KEY); } catch {}
    }
  }
}

interface GenerationState {
  model: ModelType;
  prompt: string;
  referenceImages: string[];
  referenceImagePreviews: string[];
  aspectRatio: string;
  resolution: string;
  numImages: number;
  webSearch: boolean;
  thinkingLevel: string;
  tasks: GenerationTask[];
  lightboxImage: string | null;
  setModel: (m: ModelType) => void;
  setPrompt: (p: string) => void;
  setReferenceImages: React.Dispatch<React.SetStateAction<string[]>>;
  setReferenceImagePreviews: React.Dispatch<React.SetStateAction<string[]>>;
  setAspectRatio: (r: string) => void;
  setResolution: (r: string) => void;
  setNumImages: (n: number) => void;
  setWebSearch: (w: boolean) => void;
  setThinkingLevel: (t: string) => void;
  setTasks: React.Dispatch<React.SetStateAction<GenerationTask[]>>;
  setLightboxImage: (img: string | null) => void;
  addTask: (task: GenerationTask) => void;
  updateTask: (id: string, updates: Partial<GenerationTask>) => void;
}

const GenerationContext = createContext<GenerationState | null>(null);

export function GenerationProvider({ children }: { children: ReactNode }) {
  const [model, setModel] = useState<ModelType>("nanobanana-2");
  const [prompt, setPrompt] = useState("");
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [referenceImagePreviews, setReferenceImagePreviews] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [resolution, setResolution] = useState("2k");
  const [numImages, setNumImages] = useState(1);
  const [webSearch, setWebSearch] = useState(true);
  const [thinkingLevel, setThinkingLevel] = useState("deep");
  const [tasks, setTasks] = useState<GenerationTask[]>(() => loadTasks());
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  useEffect(() => {
    saveTasks(tasks);
  }, [tasks]);

  const addTask = (task: GenerationTask) => {
    setTasks((prev) => [...prev, task]);
  };

  const updateTask = (id: string, updates: Partial<GenerationTask>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  };

  return (
    <GenerationContext.Provider
      value={{
        model, setModel,
        prompt, setPrompt,
        referenceImages, setReferenceImages,
        referenceImagePreviews, setReferenceImagePreviews,
        aspectRatio, setAspectRatio,
        resolution, setResolution,
        numImages, setNumImages,
        webSearch, setWebSearch,
        thinkingLevel, setThinkingLevel,
        tasks, setTasks,
        lightboxImage, setLightboxImage,
        addTask, updateTask,
      }}
    >
      {children}
    </GenerationContext.Provider>
  );
}

export function useGenerationStore() {
  const ctx = useContext(GenerationContext);
  if (!ctx) throw new Error("useGenerationStore must be inside GenerationProvider");
  return ctx;
}
